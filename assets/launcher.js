const $ = (selector, root = document) => root.querySelector(selector);

const viewRoot = $("#viewRoot");
const frame = $("#gameFrame");
const gameView = $("#gameView");
const gameLoader = $("#gameLoader");
const gameError = $("#gameError");
const storageKey = "voidforge.launcher.v1";

const defaults = {
  selectedId: "",
  favorites: [],
  recent: [],
  settings: {
    remember: true,
    autoFullscreen: false,
    confirmExit: true,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false,
    compact: false,
    brightness: 100,
    launch: "embedded"
  }
};

let state = loadState();
let games = [];
let activeView = "library";
let pendingGame = null;
let gameLoading = false;
let previousFocus = null;

/* -------------------------------------------------------
   State
------------------------------------------------------- */

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");

    if (!saved || typeof saved !== "object") {
      return structuredClone(defaults);
    }

    return {
      ...structuredClone(defaults),
      ...saved,
      favorites: Array.isArray(saved.favorites) ? saved.favorites : [],
      recent: Array.isArray(saved.recent) ? saved.recent : [],
      settings: {
        ...structuredClone(defaults.settings),
        ...(saved.settings && typeof saved.settings === "object"
          ? saved.settings
          : {})
      }
    };
  } catch {
    return structuredClone(defaults);
  }
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Storage can be disabled or unavailable.
  }
}

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */

function setText(node, text) {
  if (node) node.textContent = text;
  return node;
}

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);

  Object.entries(options).forEach(([key, value]) => {
    if (key === "class") {
      node.className = value;
    } else if (key === "text") {
      node.textContent = value;
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value);
    } else {
      node.setAttribute(key, value);
    }
  });

  children
    .flat()
    .filter(Boolean)
    .forEach(child => node.append(child));

  return node;
}

function button(label, className = "", handler = null) {
  return el("button", {
    class: `button ${className}`.trim(),
    type: "button",
    text: label,
    ...(handler ? { onclick: handler } : {})
  });
}

function toast(message) {
  const region = $("#toastRegion");
  if (!region) return;

  const note = el("div", {
    class: "toast",
    role: "status",
    text: message
  });

  region.append(note);

  window.setTimeout(() => {
    note.remove();
  }, 3200);
}

function selectedGame() {
  return (
    games.find(game => game.id === state.selectedId) ||
    games[0] ||
    null
  );
}

function gameUrl(game) {
  return new URL(game.entry, document.baseURI).href;
}

function applyPreferences() {
  const settings = state.settings;

  document.body.classList.toggle(
    "reduce-motion",
    Boolean(settings.reducedMotion)
  );

  document.body.classList.toggle(
    "compact-library",
    Boolean(settings.compact)
  );

  const brightness = Math.max(
    70,
    Math.min(120, Number(settings.brightness) || 100)
  );

  document.body.style.setProperty(
    "--brightness",
    String(brightness / 100)
  );
}

function selectGame(id) {
  state.selectedId = id;

  if (state.settings.remember) {
    saveState();
  }

  renderView();
}

function sanitizeGames(data) {
  if (!data || !Array.isArray(data.games)) {
    throw new Error("games.json does not contain a valid games array.");
  }

  return data.games
    .filter(game => {
      return (
        game &&
        typeof game.id === "string" &&
        typeof game.name === "string" &&
        typeof game.entry === "string" &&
        game.id.trim() &&
        game.name.trim() &&
        game.entry.trim()
      );
    })
    .filter(game => {
      // Prevent registry entries from escaping the deployment root.
      const normalized = game.entry.replace(/\\/g, "/");
      return (
        !normalized.startsWith("/") &&
        !normalized.includes("../") &&
        !normalized.includes("/..")
      );
    })
    .map(game => ({
      id: game.id,
      name: game.name,
      subtitle: typeof game.subtitle === "string" ? game.subtitle : "",
      entry: game.entry,
      version: typeof game.version === "string" ? game.version : "1.0",
      platform: typeof game.platform === "string" ? game.platform : "Browser",
      status: typeof game.status === "string" ? game.status : "Available",
      tags: Array.isArray(game.tags)
        ? game.tags.filter(tag => typeof tag === "string")
        : [],
      description:
        typeof game.description === "string"
          ? game.description
          : "No description available.",
      accent:
        typeof game.accent === "string"
          ? game.accent
          : "purple"
    }));
}

async function fetchGames() {
  const url = new URL("games.json", document.baseURI);

  // Cache-busting is useful with GitHub Pages deployments.
  url.searchParams.set("_", Date.now().toString());

  const response = await fetch(url.href, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Could not load games.json (${response.status} ${response.statusText}).`
    );
  }

  const data = await response.json();
  games = sanitizeGames(data);

  if (games.length === 0) {
    state.selectedId = "";
    saveState();
    return;
  }

  const selectedStillExists = games.some(
    game => game.id === state.selectedId
  );

  if (!selectedStillExists) {
    state.selectedId = games[0].id;
  }

  // Remove history/favorites for games that no longer exist.
  const validIds = new Set(games.map(game => game.id));

  state.favorites = state.favorites.filter(id => validIds.has(id));
  state.recent = state.recent.filter(id => validIds.has(id));

  saveState();
}

/* -------------------------------------------------------
   Library
------------------------------------------------------- */

function tags(game) {
  return el(
    "div",
    { class: "tag-list" },
    [
      el("span", {
        class: "tag",
        text: `v${game.version}`
      }),
      ...game.tags.map(tag =>
        el("span", {
          class: "tag",
          text: tag
        })
      )
    ]
  );
}

function libraryView() {
  const game = selectedGame();
  const root = document.createDocumentFragment();

  if (game) {
    root.append(
      el(
        "section",
        { class: "hero" },
        [
          el("p", {
            class: "eyebrow",
            text: "Featured · browser ready"
          }),

          el("h1", {
            text: game.name
          }),

          el("p", {
            class: "description",
            text: game.description
          }),

          el(
            "div",
            { class: "hero-meta" },
            [
              el("span", {
                class: "meta-chip",
                text: game.subtitle || "Browser game"
              }),
              el("span", {
                class: "meta-chip",
                text: `v${game.version}`
              }),
              el("span", {
                class: "meta-chip",
                text: game.platform
              })
            ]
          ),

          el(
            "div",
            { class: "button-row" },
            [
              button("▶ Play now", "primary", () => launch(game)),
              button("More information", "", () =>
                showGameInformation(game)
              )
            ]
          )
        ]
      )
    );
  } else {
    root.append(
      el(
        "section",
        { class: "empty-state" },
        [
          el("h2", {
            text: "No games found"
          }),
          el("p", {
            text: "The launcher could not find any games in games.json."
          })
        ]
      )
    );
  }

  const search = $("#gameSearch");
  const query = search
    ? search.value.trim().toLowerCase()
    : "";

  const filter = viewRoot.dataset.filter || "all";
  const order = viewRoot.dataset.order || "recent";

  let list = games.filter(item => {
    const haystack = [
      item.name,
      item.subtitle,
      item.description,
      ...item.tags
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  if (filter === "favorites") {
    list = list.filter(item =>
      state.favorites.includes(item.id)
    );
  }

  if (order === "name") {
    list.sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  } else {
    list.sort((a, b) => {
      const aIndex = state.recent.indexOf(a.id);
      const bIndex = state.recent.indexOf(b.id);

      const aRank = aIndex === -1 ? Infinity : aIndex;
      const bRank = bIndex === -1 ? Infinity : bIndex;

      return aRank - bRank;
    });
  }

  const controls = el(
    "div",
    { class: "library-controls" },
    [
      filterButton("All games", "all", filter),
      filterButton("Favorites", "favorites", filter),

      el(
        "select",
        {
          class: "select-control",
          "aria-label": "Sort games",
          onchange: event => {
            viewRoot.dataset.order = event.target.value;
            renderView();
          }
        },
        [
          el("option", {
            value: "recent",
            text: "Recently played"
          }),
          el("option", {
            value: "name",
            text: "Name A–Z"
          })
        ]
      )
    ]
  );

  controls.querySelector("select").value = order;

  root.append(
    el(
      "section",
      { class: "section" },
      [
        el(
          "div",
          { class: "section-heading" },
          [
            el(
              "div",
              {},
              [
                el("h2", {
                  text: "Your library"
                }),
                el("p", {
                  text: `${games.length} game${
                    games.length === 1 ? "" : "s"
                  } listed in this deployment`
                })
              ]
            ),
            controls
          ]
        ),

        list.length
          ? el(
              "div",
              { class: "game-grid" },
              list.map(gameCard)
            )
          : el(
              "div",
              { class: "empty-state" },
              [
                el("h3", {
                  text: "Nothing matches this view"
                }),
                el("p", {
                  text: "Try another search or show all available games."
                })
              ]
            )
      ]
    )
  );

  root.append(
    el(
      "section",
      { class: "section info-grid" },
      [
        statPanel(
          String(games.length),
          "Games registered"
        ),

        statPanel(
          state.recent[0]
            ? games.find(g => g.id === state.recent[0])?.name || "—"
            : "Not yet",
          "Last played"
        ),

        statPanel(
          "WEB",
          "Platform"
        )
      ]
    )
  );

  return root;
}

function filterButton(label, value, current) {
  return button(
    label,
    `filter-button ${
      current === value ? "is-active" : ""
    }`,
    () => {
      viewRoot.dataset.filter = value;
      renderView();
    }
  );
}

function gameCard(game) {
  const favorite = state.favorites.includes(game.id);

  const fav = button(
    favorite ? "★" : "☆",
    `favorite ${favorite ? "is-favorite" : ""}`,
    event => {
      event.stopPropagation();
      toggleFavorite(game.id);
    }
  );

  fav.setAttribute(
    "aria-label",
    `${favorite ? "Remove" : "Add"} ${
      game.name
    } ${favorite ? "from" : "to"} favorites`
  );

  return el(
    "article",
    {
      class: `game-card ${
        game.id === state.selectedId
          ? "is-selected"
          : ""
      }`
    },
    [
      el(
        "div",
        { class: "game-art" },
        [
          el("strong", {
            text: game.name
          }),
          fav
        ]
      ),

      el("h3", {
        text: game.name
      }),

      el("div", {
        class: "subtitle",
        text: game.subtitle
      }),

      el("p", {
        class: "description",
        text: game.description
      }),

      tags(game),

      el(
        "div",
        { class: "card-footer" },
        [
          el("span", {
            class: "availability",
            text: game.status === "Available"
              ? "● Available in browser"
              : `● ${game.status}`
          }),

          el(
            "div",
            { class: "button-row" },
            [
              button("Play", "primary", () =>
                launch(game)
              ),

              button("Select", "", () =>
                selectGame(game.id)
              )
            ]
          )
        ]
      )
    ]
  );
}

function statPanel(value, label) {
  return el(
    "div",
    { class: "panel" },
    [
      el("strong", {
        class: "stat-value",
        text: value
      }),
      el("span", {
        class: "stat-label",
        text: label
      })
    ]
  );
}

/* -------------------------------------------------------
   Pages
------------------------------------------------------- */

function page(title, kicker, content) {
  return el(
    "section",
    { class: "updates" },
    [
      el("p", {
        class: "eyebrow",
        text: kicker
      }),
      el("h1", {
        text: title
      }),
      content
    ]
  );
}

function discoverView() {
  return page(
    "Discover",
    "Curated from this deployment",
    el(
      "div",
      { class: "empty-state" },
      [
        el("h3", {
          text: "Your web library is up to date"
        }),

        el("p", {
          text:
            "VoidForge lists browser games declared in games.json. " +
            "New games appear after their files and registry entry are deployed."
        }),

        button(
          "Open library",
          "primary",
          () => changeView("library")
        )
      ]
    )
  );
}

function updatesView() {
  const panel = el(
    "div",
    { class: "panel" },
    [
      el(
        "div",
        { class: "update-status" },
        [
          el("i"),
          el(
            "div",
            {},
            [
              el("h2", {
                text: "You are using the deployed launcher"
              }),

              el("p", {
                text:
                  "GitHub Pages serves the newest published deployment when you reload. " +
                  "This launcher does not install or patch files on your device."
              })
            ]
          )
        ]
      ),

      el(
        "div",
        { class: "setting-row" },
        [
          el(
            "div",
            {},
            [
              el("b", {
                text: "Launcher version"
              }),
              el("small", {
                text: "1.1.0 · static web edition"
              })
            ]
          ),

          el(
            "div",
            {},
            [
              el("b", {
                text: "Game registry"
              }),
              el("small", {
                text: `${games.length} declared browser game${
                  games.length === 1 ? "" : "s"
                }`
              })
            ]
          )
        ]
      ),

      button(
        "Refresh game registry",
        "primary",
        async () => {
          try {
            await fetchGames();
            toast("Game registry refreshed.");
            renderView();
          } catch (error) {
            toast(error.message);
          }
        }
      )
    ]
  );

  return page(
    "Updates",
    "Deployment status",
    panel
  );
}

function setting(label, help, control) {
  return el(
    "div",
    { class: "setting-row" },
    [
      el(
        "div",
        {},
        [
          el("b", { text: label }),
          el("small", { text: help })
        ]
      ),
      control
    ]
  );
}

function checkbox(key) {
  const input = el("input", {
    class: "toggle",
    type: "checkbox",
    "aria-label": key,
    onchange: event => {
      state.settings[key] = event.target.checked;
      saveState();
      applyPreferences();
    }
  });

  input.checked = Boolean(state.settings[key]);

  return input;
}

function settingsView() {
  const general = el(
    "div",
    { class: "panel setting-group" },
    [
      el("h2", {
        text: "General"
      }),

      setting(
        "Remember selected game",
        "Restore your selected title on this device.",
        checkbox("remember")
      ),

      setting(
        "Auto fullscreen",
        "Request browser fullscreen after a game is launched.",
        checkbox("autoFullscreen")
      ),

      setting(
        "Confirm before exiting",
        "Ask before closing an active game session.",
        checkbox("confirmExit")
      )
    ]
  );

  const appearance = el(
    "div",
    { class: "panel setting-group" },
    [
      el("h2", {
        text: "Appearance"
      }),

      setting(
        "Reduce animations",
        "Minimize non-essential movement in the launcher.",
        checkbox("reducedMotion")
      ),

      setting(
        "Interface brightness",
        "Adjust this launcher only.",
        el("input", {
          class: "range",
          type: "range",
          min: "70",
          max: "120",
          value: state.settings.brightness,
          "aria-label": "Interface brightness",
          oninput: event => {
            state.settings.brightness =
              Number(event.target.value);

            saveState();
            applyPreferences();
          }
        })
      )
    ]
  );

  const data = el(
    "div",
    { class: "panel setting-group" },
    [
      el("h2", {
        text: "Data"
      }),

      setting(
        "Clear launcher data",
        "Removes favorites, recent plays, and preferences from this browser.",
        button(
          "Clear data",
          "danger-button",
          clearData
        )
      ),

      el("p", {
        class: "subtitle",
        text:
          "Game data is controlled by each game. " +
          "The launcher does not store credentials or install files."
      })
    ]
  );

  return page(
    "Settings",
    "Personalize your launcher",
    el(
      "div",
      {},
      [
        general,
        appearance,
        data
      ]
    )
  );
}

function aboutView() {
  const repository =
    "https://github.com/VoidForgeStudios/VoidForgeStudios.github.io";

  return page(
    "About VoidForge",
    "Browser-first game launcher",
    el(
      "div",
      { class: "panel about-list" },
      [
        el("p", {
          text:
            "VoidForge Studios Web Launcher is a static GitHub Pages interface " +
            "for browser games included in this repository."
        }),

        el("p", {
          text:
            "Launcher version: 1.1.0 · Web platform: GitHub Pages"
        }),

        el("a", {
          href: repository,
          target: "_blank",
          rel: "noopener noreferrer",
          text: "View the VoidForge repository ↗"
        }),

        el("p", {
          text:
            "BlockWorld is the bundled Minecraft-style voxel prototype. " +
            "It runs directly in the browser."
        })
      ]
    )
  );
}

/* -------------------------------------------------------
   Favorites / data
------------------------------------------------------- */

function toggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter(
      item => item !== id
    );
  } else {
    state.favorites.push(id);
  }

  saveState();
  renderView();
}

function clearData() {
  if (
    !confirm(
      "Clear all VoidForge launcher preferences, favorites, and recent game history from this browser?"
    )
  ) {
    return;
  }

  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage errors.
  }

  state = structuredClone(defaults);

  applyPreferences();
  renderView();

  toast("Launcher data cleared.");
}

function showGameInformation(game) {
  const tagText = game.tags.length
    ? game.tags.join(", ")
    : "None";

  toast(
    `${game.name} · v${game.version} · ${game.platform} · ${tagText}`
  );
}

/* -------------------------------------------------------
   Rendering / navigation
------------------------------------------------------- */

function renderView() {
  viewRoot.replaceChildren();

  const views = {
    library: libraryView,
    discover: discoverView,
    updates: updatesView,
    settings: settingsView,
    about: aboutView
  };

  const renderer = views[activeView] || libraryView;

  viewRoot.append(renderer());

  document
    .querySelectorAll("[data-view]")
    .forEach(node => {
      node.classList.toggle(
        "is-active",
        node.dataset.view === activeView
      );
    });
}

function changeView(view) {
  const validViews = [
    "library",
    "discover",
    "updates",
    "settings",
    "about"
  ];

  if (!validViews.includes(view)) {
    view = "library";
  }

  activeView = view;

  closeMobileNavigation();
  renderView();

  window.scrollTo({
    top: 0,
    behavior: state.settings.reducedMotion
      ? "auto"
      : "smooth"
  });

  requestAnimationFrame(() => {
    viewRoot.focus?.();
  });
}

/* -------------------------------------------------------
   Game launching
------------------------------------------------------- */

async function launch(game) {
  if (!game || !game.entry) {
    toast("This game has no valid entry point.");
    return;
  }

  if (gameLoading) {
    return;
  }

  gameLoading = true;
  pendingGame = game;
  previousFocus = document.activeElement;

  gameView.hidden = false;
  document.body.classList.add("game-open");

  setText(
    $("#playingGameTitle"),
    game.name
  );

  setText(
    $("#gameLoadStatus"),
    "Starting game…"
  );

  setText(
    $("#loadingStep"),
    "Starting game"
  );

  setText(
    $("#loadingDetail"),
    `Opening ${game.entry}`
  );

  gameLoader.hidden = false;
  gameError.hidden = true;

  frame.onload = handleGameLoad;
  frame.onerror = handleGameError;

  /*
   * IMPORTANT:
   * Do NOT perform a HEAD request first.
   *
   * GitHub Pages is a static host and the safest approach
   * is to directly load the actual HTML entry point.
   */
  const url = gameUrl(game);

  console.info("[VoidForge] Loading game:", {
    name: game.name,
    entry: game.entry,
    url
  });

  frame.removeAttribute("src");

  // Give the browser a rendering tick before changing iframe src.
  await new Promise(resolve =>
    requestAnimationFrame(resolve)
  );

  frame.src = url;
}

function handleGameLoad() {
  gameLoading = false;

  gameLoader.hidden = true;
  gameError.hidden = true;

  setText(
    $("#gameLoadStatus"),
    "Ready"
  );

  if (pendingGame) {
    state.recent = [
      pendingGame.id,
      ...state.recent.filter(
        id => id !== pendingGame.id
      )
    ].slice(0, 5);

    saveState();
  }

  if (state.settings.autoFullscreen) {
    requestGameFullscreen();
  }
}

function handleGameError() {
  gameLoading = false;

  if (!pendingGame) {
    showGameFailure(
      "The game could not start",
      "The browser reported an error while loading the game."
    );
    return;
  }

  showGameFailure(
    "The game could not start",
    `VoidForge tried to load "${pendingGame.entry}". ` +
      "Make sure that file exists in the deployed GitHub Pages repository."
  );
}

function showGameFailure(title, detail) {
  gameLoader.hidden = true;

  gameError.hidden = false;

  gameError.replaceChildren(
    el("h2", {
      text: title
    }),

    el("p", {
      text: detail
    }),

    el(
      "div",
      { class: "button-row" },
      [
        button(
          "Return to launcher",
          "primary",
          exitGame
        ),

        button(
          "Retry",
          "",
          () => pendingGame && launch(pendingGame)
        )
      ]
    )
  );

  setText(
    $("#gameLoadStatus"),
    "Launch failed"
  );
}

function requestGameFullscreen() {
  /*
   * Try the iframe itself first.
   *
   * If the browser does not permit iframe fullscreen,
   * fall back to fullscreen on the launcher game view.
   */
  if (frame.requestFullscreen) {
    frame.requestFullscreen().catch(() => {
      gameView.requestFullscreen?.().catch(() => {});
    });

    return;
  }

  gameView.requestFullscreen?.().catch(() => {});
}

function reloadGame() {
  if (!pendingGame) {
    return;
  }

  gameLoading = false;

  const game = pendingGame;

  frame.onload = null;
  frame.onerror = null;

  gameLoader.hidden = false;
  gameError.hidden = true;

  setText(
    $("#gameLoadStatus"),
    "Reloading…"
  );

  setText(
    $("#loadingStep"),
    "Reloading game"
  );

  setText(
    $("#loadingDetail"),
    "Opening the game again."
  );

  frame.src = "about:blank";

  window.setTimeout(() => {
    launch(game);
  }, 50);
}

function exitGame() {
  const hasGame =
    !gameView.hidden &&
    Boolean(frame.getAttribute("src")) &&
    frame.getAttribute("src") !== "about:blank";

  if (
    hasGame &&
    state.settings.confirmExit &&
    !confirm("Exit the current game session?")
  ) {
    return;
  }

  gameLoading = false;

  frame.onload = null;
  frame.onerror = null;

  frame.src = "about:blank";

  gameView.hidden = true;
  document.body.classList.remove("game-open");

  pendingGame = null;

  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  }

  if (
    previousFocus &&
    typeof previousFocus.focus === "function" &&
    document.contains(previousFocus)
  ) {
    previousFocus.focus();
  }

  previousFocus = null;

  setText(
    $("#gameLoadStatus"),
    "Checking game files…"
  );
}

/* -------------------------------------------------------
   Mobile navigation
------------------------------------------------------- */

function closeMobileNavigation() {
  const nav = $(".mobile-nav");

  if (!nav) {
    return;
  }

  nav.hidden = true;

  $("#mobileMenu")?.setAttribute(
    "aria-expanded",
    "false"
  );
}

function toggleMobileNavigation() {
  const nav = $(".mobile-nav");
  const menu = $("#mobileMenu");

  if (!nav || !menu) {
    return;
  }

  nav.hidden = !nav.hidden;

  menu.setAttribute(
    "aria-expanded",
    String(!nav.hidden)
  );
}

/* -------------------------------------------------------
   Events
------------------------------------------------------- */

document.addEventListener("click", event => {
  const target = event.target.closest("[data-view]");

  if (!target) {
    return;
  }

  changeView(target.dataset.view);
});

$("#gameSearch")?.addEventListener("input", () => {
  if (activeView !== "library") {
    activeView = "library";
  }

  renderView();
});

$("#fullscreenLauncher")?.addEventListener(
  "click",
  () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      return;
    }

    document.documentElement
      .requestFullscreen?.()
      .catch(() => {
        toast("Fullscreen is not available.");
      });
  }
);

$("#gameFullscreen")?.addEventListener(
  "click",
  requestGameFullscreen
);

$("#reloadGame")?.addEventListener(
  "click",
  reloadGame
);

$("#gameInfo")?.addEventListener(
  "click",
  () => {
    if (pendingGame) {
      showGameInformation(pendingGame);
    }
  }
);

$("#exitGame")?.addEventListener(
  "click",
  exitGame
);

$("#mobileMenu")?.addEventListener(
  "click",
  toggleMobileNavigation
);

document.addEventListener("keydown", event => {
  const active = document.activeElement;

  const isTyping =
    active &&
    /input|textarea|select/i.test(
      active.tagName
    );

  if (
    event.key === "/" &&
    !isTyping
  ) {
    event.preventDefault();
    $("#gameSearch")?.focus();
  }

  if (
    event.key === "Escape" &&
    !gameView.hidden
  ) {
    exitGame();
  }
});

window.addEventListener("hashchange", () => {
  const view = location.hash.replace("#", "");

  if (
    ["library", "discover", "updates", "settings", "about"]
      .includes(view)
  ) {
    activeView = view;
    renderView();
  }
});

/* -------------------------------------------------------
   Initialization
------------------------------------------------------- */

async function initialize() {
  applyPreferences();

  // The mobile nav should start closed.
  const mobileNav = $(".mobile-nav");
  if (mobileNav) {
    mobileNav.hidden = true;
  }

  try {
    await fetchGames();

    setText(
      $("#connectionStatus"),
      "Launcher ready"
    );

    console.info(
      `[VoidForge] Loaded ${games.length} game(s).`
    );
  } catch (error) {
    games = [];

    setText(
      $("#connectionStatus"),
      "Registry unavailable"
    );

    console.error(
      "[VoidForge] Initialization failed:",
      error
    );

    toast(error.message);
  }

  renderView();

  if ("serviceWorker" in navigator) {
    const swUrl = new URL(
      "sw.js",
      document.baseURI
    );

    navigator.serviceWorker
      .register(swUrl.href)
      .then(() => {
        console.info(
          "[VoidForge] Service worker registered."
        );
      })
      .catch(error => {
        /*
         * Service worker failure must NEVER prevent
         * the launcher or games from working.
         */
        console.warn(
          "[VoidForge] Service worker unavailable:",
          error
        );
      });
  }
}

initialize();
