(() => {
  "use strict";

  /*
   * ============================================================
   * VOIDFORGE LAUNCHER
   * ============================================================
   *
   * Games are defined in games.json like:
   *
   * {
   *   "id": "minecraft",
   *   "name": "Minecraft",
   *   "entry": "minecraft"
   * }
   *
   * The launcher converts:
   *
   *   minecraft
   *
   * into:
   *
   *   minecraft/index.html
   *
   * IMPORTANT:
   * We intentionally keep the iframe src RELATIVE.
   *
   * The DOM attribute becomes:
   *
   *   src="minecraft/index.html"
   *
   * rather than:
   *
   *   src="https://example.com/minecraft/index.html"
   * ============================================================
   */

  const $ = (selector, root = document) => {
    return root.querySelector(selector);
  };

  const $$ = (selector, root = document) => {
    return Array.from(root.querySelectorAll(selector));
  };

  const viewRoot = $("#viewRoot");
  const frame = $("#gameFrame");
  const gameView = $("#gameView");
  const gameLoader = $("#gameLoader");
  const gameError = $("#gameError");

  const STORAGE_KEY = "voidforge.launcher.v2";
  const GAMES_URL = "games.json";

  const DEFAULT_STATE = {
    selectedId: null,

    favorites: [],

    recent: [],

    settings: {
      remember: true,
      autoFullscreen: false,
      confirmExit: true,
      reducedMotion: false,
      compact: false,
      brightness: 100,
      launch: "embedded"
    }
  };

  let state = loadState();
  let games = [];

  let currentPage = "library";

  let pendingGame = null;
  let gameLoading = false;
  let gameStartedAt = 0;

  let previousFocus = null;

  let searchTerm = "";
  let activeFilter = "all";

  /*
   * ------------------------------------------------------------
   * STORAGE
   * ------------------------------------------------------------
   */

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function loadState() {
    const fallback = cloneDefaultState();

    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return fallback;
      }

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object") {
        return fallback;
      }

      return {
        ...fallback,
        ...parsed,

        favorites: Array.isArray(parsed.favorites)
          ? parsed.favorites
          : [],

        recent: Array.isArray(parsed.recent)
          ? parsed.recent
          : [],

        settings: {
          ...fallback.settings,
          ...(parsed.settings || {})
        }
      };
    } catch (error) {
      console.warn("Unable to load launcher state:", error);
      return fallback;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.warn("Unable to save launcher state:", error);
    }
  }

  /*
   * ------------------------------------------------------------
   * DOM HELPERS
   * ------------------------------------------------------------
   */

  function setText(element, value) {
    if (!element) return;

    element.textContent =
      value === undefined ||
      value === null
        ? ""
        : String(value);
  }

  function el(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function button(text, className, handler) {
    const element = document.createElement("button");

    element.type = "button";
    element.textContent = text;

    if (className) {
      element.className = className;
    }

    if (handler) {
      element.addEventListener("click", handler);
    }

    return element;
  }

  function toast(message) {
    let container = $("#toastContainer");

    if (!container) {
      container = el("div", "toast-container");
      container.id = "toastContainer";
      document.body.appendChild(container);
    }

    const item = el("div", "toast", message);

    container.appendChild(item);

    requestAnimationFrame(() => {
      item.classList.add("show");
    });

    window.setTimeout(() => {
      item.classList.remove("show");

      window.setTimeout(() => {
        item.remove();
      }, 250);
    }, 2600);
  }

  /*
   * ------------------------------------------------------------
   * GAME ENTRY / PATH HANDLING
   * ------------------------------------------------------------
   *
   * THIS IS THE IMPORTANT SECTION.
   *
   * games.json:
   *
   *   "entry": "minecraft"
   *
   * becomes:
   *
   *   minecraft/index.html
   *
   * No absolute URL is generated.
   * No document.baseURI conversion is performed.
   * No hostname is added.
   */

  function normalizeGameFolder(entry) {
    let folder = String(entry || "")
      .trim()
      .replace(/\\/g, "/");

    /*
     * Remove leading ./ because we want:
     *
     * minecraft/index.html
     *
     * rather than:
     *
     * ./minecraft/index.html
     */

    folder = folder.replace(/^(\.\/)+/, "");

    /*
     * Remove leading/trailing slashes.
     */

    folder = folder
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    /*
     * Reject empty folders.
     */

    if (!folder) {
      throw new Error("Game folder is empty.");
    }

    /*
     * Reject obvious traversal attempts.
     */

    if (
      folder === "." ||
      folder === ".." ||
      folder.includes("../") ||
      folder.includes("/..") ||
      folder.startsWith("../") ||
      folder.endsWith("/..")
    ) {
      throw new Error(
        `Invalid game folder: ${entry}`
      );
    }

    /*
     * Do not allow the entry to directly specify an HTML file.
     *
     * The launcher controls the index.html filename.
     *
     * This means:
     *
     *   minecraft       -> allowed
     *   minecraft/      -> allowed
     *
     *   minecraft/index.html -> rejected
     */

    if (/\.html?$/i.test(folder)) {
      throw new Error(
        `Game entry must be a folder, not an HTML file: ${entry}`
      );
    }

    /*
     * Reject URL schemes.
     */

    if (
      /^[a-z][a-z0-9+.-]*:/i.test(folder) ||
      folder.startsWith("//")
    ) {
      throw new Error(
        `External game paths are not allowed: ${entry}`
      );
    }

    /*
     * Reject encoded traversal.

     * This is intentionally conservative.
     */

    const lower = folder.toLowerCase();

    if (
      lower.includes("%2e%2e") ||
      lower.includes("%2f") ||
      lower.includes("%5c")
    ) {
      throw new Error(
        `Unsafe game folder: ${entry}`
      );
    }

    return folder;
  }

  function gameUrl(game) {
    const folder = normalizeGameFolder(
      game.entry
    );

    /*
     * Return ONLY a relative path starting with ./.
     *
     * Examples:
     *
     *   minecraft
     *   -> ./minecraft/index.html
     *
     *   games/minecraft
     *   -> ./games/minecraft/index.html
     */

    return `./${folder}/index.html`;
  }

  /*
   * ------------------------------------------------------------
   * GAME VALIDATION
   * ------------------------------------------------------------
   */

  function sanitizeGames(data) {
    if (!Array.isArray(data)) {
      throw new Error(
        "games.json must contain an array."
      );
    }

    const output = [];
    const ids = new Set();

    for (const raw of data) {
      if (!raw || typeof raw !== "object") {
        continue;
      }

      const id = String(raw.id || "").trim();
      const name = String(raw.name || "").trim();
      const entry = String(raw.entry || "").trim();

      if (!id || !name || !entry) {
        console.warn(
          "Skipping incomplete game:",
          raw
        );

        continue;
      }

      if (ids.has(id)) {
        console.warn(
          "Skipping duplicate game:",
          id
        );

        continue;
      }

      let normalizedEntry;

      try {
        normalizedEntry =
          normalizeGameFolder(entry);
      } catch (error) {
        console.warn(
          "Skipping invalid game:",
          id,
          error
        );

        continue;
      }

      ids.add(id);

      const tags = Array.isArray(raw.tags)
        ? raw.tags
            .map(tag => String(tag).trim())
            .filter(Boolean)
        : [];

      output.push({
        id,

        name,

        subtitle:
          String(raw.subtitle || "").trim(),

        entry: normalizedEntry,

        version:
          String(raw.version || "").trim(),

        platform:
          String(raw.platform || "Browser").trim(),

        status:
          String(raw.status || "Available").trim(),

        description:
          String(raw.description || "").trim(),

        tags,

        icon:
          String(raw.icon || "").trim(),

        image:
          String(raw.image || "").trim(),

        category:
          String(raw.category || "").trim(),

        featured:
          Boolean(raw.featured)
      });
    }

    return output;
  }

  /*
   * ------------------------------------------------------------
   * FETCH GAMES
   * ------------------------------------------------------------
   */

  async function fetchGames() {
    const url =
      `${GAMES_URL}?t=${Date.now()}`;

    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error(
        `games.json failed with HTTP ${response.status}`
      );
    }

    const data = await response.json();

    return sanitizeGames(data);
  }

  /*
   * ------------------------------------------------------------
   * GAME LOOKUP
   * ------------------------------------------------------------
   */

  function selectedGame() {
    return games.find(
      game => game.id === state.selectedId
    ) || null;
  }

  function getGameById(id) {
    return games.find(
      game => game.id === id
    ) || null;
  }

  /*
   * ------------------------------------------------------------
   * PREFERENCES
   * ------------------------------------------------------------
   */

  function applyPreferences() {
    const settings = state.settings || {};

    document.documentElement.style.setProperty(
      "--launcher-brightness",
      `${Number(settings.brightness) || 100}%`
    );

    document.documentElement.classList.toggle(
      "reduced-motion",
      Boolean(settings.reducedMotion)
    );

    document.documentElement.classList.toggle(
      "compact-mode",
      Boolean(settings.compact)
    );

    const remember =
      $("#settingRemember");

    if (remember) {
      remember.checked =
        Boolean(settings.remember);
    }

    const autoFullscreen =
      $("#settingAutoFullscreen");

    if (autoFullscreen) {
      autoFullscreen.checked =
        Boolean(settings.autoFullscreen);
    }

    const confirmExit =
      $("#settingConfirmExit");

    if (confirmExit) {
      confirmExit.checked =
        Boolean(settings.confirmExit);
    }

    const reducedMotion =
      $("#settingReducedMotion");

    if (reducedMotion) {
      reducedMotion.checked =
        Boolean(settings.reducedMotion);
    }

    const compact =
      $("#settingCompact");

    if (compact) {
      compact.checked =
        Boolean(settings.compact);
    }

    const brightness =
      $("#settingBrightness");

    if (brightness) {
      brightness.value =
        settings.brightness;
    }

    const launch =
      $("#settingLaunch");

    if (launch) {
      launch.value =
        settings.launch;
    }
  }

  /*
   * ------------------------------------------------------------
   * SELECT GAME
   * ------------------------------------------------------------
   */

  function selectGame(id, options = {}) {
    const game = getGameById(id);

    if (!game) {
      return;
    }

    state.selectedId = game.id;

    if (options.remember !== false) {
      saveState();
    }

    renderAll();

    if (options.scroll !== false) {
      const card =
        document.querySelector(
          `[data-game-id="${CSS.escape(game.id)}"]`
        );

      if (card) {
        card.scrollIntoView({
          behavior:
            state.settings.reducedMotion
              ? "auto"
              : "smooth",
          block: "center"
        });
      }
    }
  }

  /*
   * ------------------------------------------------------------
   * FAVORITES
   * ------------------------------------------------------------ */

  function isFavorite(id) {
    return state.favorites.includes(id);
  }

  function toggleFavorite(id) {
    if (isFavorite(id)) {
      state.favorites =
        state.favorites.filter(
          value => value !== id
        );

      toast("Removed from favorites.");
    } else {
      state.favorites.push(id);

      toast("Added to favorites.");
    }

    saveState();
    renderAll();
  }

  /*
   * ------------------------------------------------------------
   * RECENT
   * ------------------------------------------------------------ */

  function addRecent(id) {
    state.recent =
      state.recent.filter(
        value => value !== id
      );

    state.recent.unshift(id);

    state.recent =
      state.recent.slice(0, 12);

    saveState();
  }

  /*
   * ------------------------------------------------------------
   * FILTERING
   * ------------------------------------------------------------ */

  function gameMatchesSearch(game) {
    if (!searchTerm) {
      return true;
    }

    const haystack = [
      game.name,
      game.subtitle,
      game.description,
      game.platform,
      game.status,
      game.category,
      ...game.tags
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(
      searchTerm.toLowerCase()
    );
  }

  function gameMatchesFilter(game) {
    switch (activeFilter) {
      case "favorites":
        return isFavorite(game.id);

      case "recent":
        return state.recent.includes(game.id);

      case "featured":
        return Boolean(game.featured);

      case "3d":
        return game.tags.some(
          tag =>
            tag.toLowerCase() === "3d"
        );

      case "arcade":
        return game.tags.some(
          tag =>
            tag.toLowerCase() === "arcade"
        );

      default:
        return true;
    }
  }

  function filteredGames() {
    return games.filter(
      game =>
        gameMatchesSearch(game) &&
        gameMatchesFilter(game)
    );
  }

  /*
   * ------------------------------------------------------------
   * GAME CARD
   * ------------------------------------------------------------
   */

  function createGameCard(game) {
    const card =
      el("article", "game-card");

    card.dataset.gameId = game.id;

    if (state.selectedId === game.id) {
      card.classList.add("selected");
    }

    const media =
      el("div", "game-card-media");

    if (game.image) {
      const image =
        document.createElement("img");

      image.src = game.image;
      image.alt = game.name;
      image.loading = "lazy";

      image.addEventListener(
        "error",
        () => {
          image.remove();
          media.classList.add(
            "fallback-media"
          );
        }
      );

      media.appendChild(image);
    } else {
      const icon =
        el(
          "div",
          "game-card-icon",
          game.icon || "VF"
        );

      media.appendChild(icon);
    }

    const content =
      el("div", "game-card-content");

    const title =
      el("h3", "game-card-title", game.name);

    const subtitle =
      el(
        "p",
        "game-card-subtitle",
        game.subtitle
      );

    const description =
      el(
        "p",
        "game-card-description",
        game.description
      );

    const meta =
      el("div", "game-card-meta");

    if (game.version) {
      meta.appendChild(
        el(
          "span",
          "game-meta-item",
          `v${game.version}`
        )
      );
    }

    if (game.platform) {
      meta.appendChild(
        el(
          "span",
          "game-meta-item",
          game.platform
        )
      );
    }

    if (game.status) {
      meta.appendChild(
        el(
          "span",
          "game-meta-item",
          game.status
        )
      );
    }

    const tags =
      el("div", "game-card-tags");

    game.tags
      .slice(0, 4)
      .forEach(tag => {
        tags.appendChild(
          el("span", "game-tag", tag)
        );
      });

    const actions =
      el("div", "game-card-actions");

    const launchButton =
      button(
        "Launch",
        "game-launch-button",
        event => {
          event.stopPropagation();

          selectGame(game.id, {
            scroll: false
          });

          launch(game);
        }
      );

    const favoriteButton =
      button(
        isFavorite(game.id)
          ? "★"
          : "☆",
        "game-favorite-button",
        event => {
          event.stopPropagation();

          toggleFavorite(game.id);
        }
      );

    favoriteButton.setAttribute(
      "aria-label",
      isFavorite(game.id)
        ? `Remove ${game.name} from favorites`
        : `Add ${game.name} to favorites`
    );

    actions.appendChild(
      launchButton
    );

    actions.appendChild(
      favoriteButton
    );

    content.appendChild(title);

    if (game.subtitle) {
      content.appendChild(subtitle);
    }

    if (game.description) {
      content.appendChild(description);
    }

    if (meta.children.length) {
      content.appendChild(meta);
    }

    if (tags.children.length) {
      content.appendChild(tags);
    }

    content.appendChild(actions);

    card.appendChild(media);
    card.appendChild(content);

    card.addEventListener(
      "click",
      () => {
        selectGame(game.id);
      }
    );

    card.addEventListener(
      "dblclick",
      () => {
        launch(game);
      }
    );

    return card;
  }

  /*
   * ------------------------------------------------------------
   * HERO
   * ------------------------------------------------------------
   */

  function renderHero() {
    const game =
      selectedGame() ||
      games.find(
        item => item.featured
      ) ||
      games[0];

    const title =
      $("#heroTitle");

    const subtitle =
      $("#heroSubtitle");

    const description =
      $("#heroDescription");

    const launchButton =
      $("#heroLaunch");

    const favoriteButton =
      $("#heroFavorite");

    if (!game) {
      setText(
        title,
        "No games available"
      );

      setText(
        subtitle,
        ""
      );

      setText(
        description,
        "Add games to games.json."
      );

      if (launchButton) {
        launchButton.disabled = true;
      }

      return;
    }

    state.selectedId = game.id;

    setText(
      title,
      game.name
    );

    setText(
      subtitle,
      game.subtitle
    );

    setText(
      description,
      game.description
    );

    if (launchButton) {
      launchButton.disabled = false;

      launchButton.onclick = () => {
        launch(game);
      };
    }

    if (favoriteButton) {
      favoriteButton.textContent =
        isFavorite(game.id)
          ? "★ Favorited"
          : "☆ Favorite";

      favoriteButton.onclick = () => {
        toggleFavorite(game.id);
      };
    }

    const heroImage =
      $("#heroImage");

    if (heroImage) {
      if (game.image) {
        heroImage.src = game.image;
        heroImage.alt = game.name;
        heroImage.hidden = false;
      } else {
        heroImage.removeAttribute(
          "src"
        );

        heroImage.hidden = true;
      }
    }
  }

  /*
   * ------------------------------------------------------------
   * LIBRARY
   * ------------------------------------------------------------
   */

  function renderLibrary() {
    const grid =
      $("#gameGrid");

    if (!grid) {
      return;
    }

    grid.replaceChildren();

    renderHero();

    const visible =
      filteredGames();

    if (!visible.length) {
      const empty =
        el(
          "div",
          "empty-state"
        );

      const heading =
        el(
          "h3",
          "",
          "No games found"
        );

      const text =
        el(
          "p",
          "",
          searchTerm
            ? "Try a different search."
            : "No games match this filter."
        );

      empty.appendChild(heading);
      empty.appendChild(text);

      grid.appendChild(empty);

      return;
    }

    visible.forEach(game => {
      grid.appendChild(
        createGameCard(game)
      );
    });
  }

  /*
   * ------------------------------------------------------------
   * RECENT
   * ------------------------------------------------------------
   */

  function recentGames() {
    return state.recent
      .map(id => getGameById(id))
      .filter(Boolean);
  }

  function renderRecent() {
    const container =
      $("#recentGames");

    if (!container) {
      return;
    }

    container.replaceChildren();

    recentGames()
      .slice(0, 6)
      .forEach(game => {
        container.appendChild(
          createGameCard(game)
        );
      });
  }

  /*
   * ------------------------------------------------------------
   * FAVORITES
   * ------------------------------------------------------------
   */

  function renderFavorites() {
    const container =
      $("#favoriteGames");

    if (!container) {
      return;
    }

    container.replaceChildren();

    games
      .filter(game =>
        isFavorite(game.id)
      )
      .forEach(game => {
        container.appendChild(
          createGameCard(game)
        );
      });
  }

  /*
   * ------------------------------------------------------------
   * DISCOVER
   * ------------------------------------------------------------
   */

  function renderDiscover() {
    const container =
      $("#discoverGrid");

    if (!container) {
      return;
    }

    container.replaceChildren();

    games
      .filter(game =>
        game.featured
      )
      .forEach(game => {
        container.appendChild(
          createGameCard(game)
        );
      });
  }

  /*
   * ------------------------------------------------------------
   * UPDATES
   * ------------------------------------------------------------
   */

  function renderUpdates() {
    const container =
      $("#updatesList");

    if (!container) {
      return;
    }

    container.replaceChildren();

    games.forEach(game => {
      const item =
        el("div", "update-item");

      const title =
        el(
          "h3",
          "",
          game.name
        );

      const version =
        el(
          "span",
          "",
          game.version
            ? `v${game.version}`
            : "Current"
        );

      const description =
        el(
          "p",
          "",
          game.description ||
            "No update notes available."
        );

      item.appendChild(title);
      item.appendChild(version);
      item.appendChild(description);

      container.appendChild(item);
    });
  }

  /*
   * ------------------------------------------------------------
   * SETTINGS
   * ------------------------------------------------------------
   */

  function setupSettings() {
    const remember =
      $("#settingRemember");

    if (remember) {
      remember.addEventListener(
        "change",
        () => {
          state.settings.remember =
            remember.checked;

          saveState();
        }
      );
    }

    const autoFullscreen =
      $("#settingAutoFullscreen");

    if (autoFullscreen) {
      autoFullscreen.addEventListener(
        "change",
        () => {
          state.settings.autoFullscreen =
            autoFullscreen.checked;

          saveState();
        }
      );
    }

    const confirmExit =
      $("#settingConfirmExit");

    if (confirmExit) {
      confirmExit.addEventListener(
        "change",
        () => {
          state.settings.confirmExit =
            confirmExit.checked;

          saveState();
        }
      );
    }

    const reducedMotion =
      $("#settingReducedMotion");

    if (reducedMotion) {
      reducedMotion.addEventListener(
        "change",
        () => {
          state.settings.reducedMotion =
            reducedMotion.checked;

          saveState();
          applyPreferences();
        }
      );
    }

    const compact =
      $("#settingCompact");

    if (compact) {
      compact.addEventListener(
        "change",
        () => {
          state.settings.compact =
            compact.checked;

          saveState();
          applyPreferences();
        }
      );
    }

    const brightness =
      $("#settingBrightness");

    if (brightness) {
      brightness.addEventListener(
        "input",
        () => {
          state.settings.brightness =
            Number(brightness.value);

          applyPreferences();
        }
      );

      brightness.addEventListener(
        "change",
        () => {
          saveState();
        }
      );
    }

    const launch =
      $("#settingLaunch");

    if (launch) {
      launch.addEventListener(
        "change",
        () => {
          state.settings.launch =
            launch.value;

          saveState();
        }
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * SEARCH
   * ------------------------------------------------------------
   */

  function setupSearch() {
    const search =
      $("#gameSearch");

    if (!search) {
      return;
    }

    search.addEventListener(
      "input",
      () => {
        searchTerm =
          search.value.trim();

        renderLibrary();
      }
    );

    search.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape") {
          search.value = "";
          searchTerm = "";

          renderLibrary();
        }
      }
    );
  }

  /*
   * ------------------------------------------------------------
   * FILTER BUTTONS
   * ------------------------------------------------------------
   */

  function setupFilters() {
    $$(".filter-button")
      .forEach(buttonElement => {
        buttonElement.addEventListener(
          "click",
          () => {
            activeFilter =
              buttonElement.dataset.filter ||
              "all";

            $$(".filter-button")
              .forEach(item => {
                item.classList.toggle(
                  "active",
                  item === buttonElement
                );
              });

            renderLibrary();
          }
        );
      });
  }

  /*
   * ------------------------------------------------------------
   * PAGE NAVIGATION
   * ------------------------------------------------------------
   */

  function showPage(page) {
    currentPage = page;

    $$(".page").forEach(pageElement => {
      pageElement.hidden =
        pageElement.dataset.page !== page;
    });

    $$(".nav-link").forEach(link => {
      link.classList.toggle(
        "active",
        link.dataset.page === page
      );
    });

    if (page === "library") {
      renderLibrary();
    }

    if (page === "discover") {
      renderDiscover();
    }

    if (page === "updates") {
      renderUpdates();
    }

    if (page === "settings") {
      applyPreferences();
    }
  }

  function setupNavigation() {
    $$(".nav-link").forEach(link => {
      link.addEventListener(
        "click",
        event => {
          event.preventDefault();

          const page =
            link.dataset.page;

          if (!page) {
            return;
          }

          showPage(page);

          history.replaceState(
            null,
            "",
            `#${page}`
          );
        }
      );
    });
  }

  /*
   * ------------------------------------------------------------
   * LAUNCHING
   * ------------------------------------------------------------
   */

  function setGameLoading(value) {
    gameLoading = value;

    if (gameView) {
      gameView.classList.toggle(
        "loading",
        value
      );
    }

    if (gameLoader) {
      gameLoader.hidden = !value;
    }
  }

  function clearGameError() {
    if (!gameError) {
      return;
    }

    gameError.hidden = true;
    gameError.replaceChildren();
  }

  function showGameFailure(game, error) {
    setGameLoading(false);

    if (!gameError) {
      toast(
        `Unable to load ${game.name}.`
      );

      console.error(error);

      return;
    }

    gameError.hidden = false;

    gameError.replaceChildren();

    const title =
      el(
        "h2",
        "",
        "Unable to load game"
      );

    const message =
      el(
        "p",
        "",
        `${game.name} could not be loaded.`
      );

    const path =
      el(
        "code",
        "",
        gameUrl(game)
      );

    const actions =
      el(
        "div",
        "game-error-actions"
      );

    const retry =
      button(
        "Retry",
        "",
        () => {
          reloadGame();
        }
      );

    const exit =
      button(
        "Back to Library",
        "",
        () => {
          exitGame(false);
        }
      );

    actions.appendChild(retry);
    actions.appendChild(exit);

    gameError.appendChild(title);
    gameError.appendChild(message);
    gameError.appendChild(path);
    gameError.appendChild(actions);

    console.error(
      "Game loading error:",
      error
    );
  }

  function launch(game) {
    if (!game) {
      toast("No game selected.");
      return;
    }

    let relativeUrl;

    try {
      relativeUrl =
        gameUrl(game);
    } catch (error) {
      showGameFailure(
        game,
        error
      );

      return;
    }

    previousFocus =
      document.activeElement;

    pendingGame = game;

    gameStartedAt =
      Date.now();

    addRecent(game.id);

    clearGameError();

    setText(
      $("#gameTitle"),
      game.name
    );

    setText(
      $("#gameStatus"),
      `Loading ${game.name}…`
    );

    if (gameView) {
      gameView.hidden = false;
    }

    document.body.classList.add(
      "game-open"
    );

    setGameLoading(true);

    /*
     * ----------------------------------------------------------
     * CRITICAL:
     *
     * Do not do:
     *
     *   frame.src = new URL(...).href
     *
     * because that creates an absolute URL.
     *
     * Instead:
     *
     *   frame.setAttribute("src", relativeUrl)
     *
     * This keeps the DOM attribute as:
     *
     *   src="minecraft/index.html"
     * ----------------------------------------------------------
     */

    if (frame) {
      frame.setAttribute(
        "src",
        relativeUrl
      );
    }

    /*
     * Auto fullscreen after load.
     */

    if (
      state.settings.autoFullscreen
    ) {
      window.setTimeout(() => {
        requestGameFullscreen();
      }, 800);
    }

    /*
     * Update URL hash without
     * exposing the actual game path.
     */

    try {
      history.pushState(
        {
          game: game.id
        },
        "",
        `#game/${encodeURIComponent(
          game.id
        )}`
      );
    } catch {
      // Ignore history errors.
    }
  }

  /*
   * ------------------------------------------------------------
   * GAME FRAME EVENTS
   * ------------------------------------------------------------
   */

  function handleGameLoad() {
    setGameLoading(false);

    if (!pendingGame) {
      return;
    }

    setText(
      $("#gameStatus"),
      `${pendingGame.name} is running`
    );

    /*
     * Optional diagnostics.
     */

    if (frame) {
      console.debug(
        "Game iframe src attribute:",
        frame.getAttribute("src")
      );

      console.debug(
        "Game iframe resolved src:",
        frame.src
      );
    }
  }

  function handleGameError(event) {
    if (!pendingGame) {
      return;
    }

    showGameFailure(
      pendingGame,
      event
    );
  }

  /*
   * ------------------------------------------------------------
   * FULLSCREEN
   * ------------------------------------------------------------
   */

  async function requestGameFullscreen() {
    if (!gameView) {
      return;
    }

    try {
      if (
        document.fullscreenElement
      ) {
        return;
      }

      if (
        gameView.requestFullscreen
      ) {
        await gameView.requestFullscreen();
      }
    } catch (error) {
      console.warn(
        "Fullscreen request failed:",
        error
      );
    }
  }

  async function exitFullscreen() {
    try {
      if (
        document.fullscreenElement
      ) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn(
        "Unable to exit fullscreen:",
        error
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * RELOAD
   * ------------------------------------------------------------
   */

  function reloadGame() {
    if (!pendingGame || !frame) {
      return;
    }

    let relativeUrl;

    try {
      relativeUrl =
        gameUrl(pendingGame);
    } catch (error) {
      showGameFailure(
        pendingGame,
        error
      );

      return;
    }

    clearGameError();

    setGameLoading(true);

    setText(
      $("#gameStatus"),
      `Reloading ${pendingGame.name}…`
    );

    /*
     * Resetting the attribute first forces
     * browsers to create a fresh navigation.
     */

    frame.setAttribute(
      "src",
      "about:blank"
    );

    window.setTimeout(() => {
      if (!frame || !pendingGame) {
        return;
      }

      frame.setAttribute(
        "src",
        relativeUrl
      );
    }, 30);
  }

  /*
   * ------------------------------------------------------------
   * EXIT GAME
   * ------------------------------------------------------------
   */

  async function exitGame(force = false) {
    if (
      !force &&
      state.settings.confirmExit &&
      pendingGame
    ) {
      const confirmed =
        window.confirm(
          `Exit ${pendingGame.name}?`
        );

      if (!confirmed) {
        return;
      }
    }

    await exitFullscreen();

    /*
     * Stop the game completely.
     */

    if (frame) {
      frame.setAttribute(
        "src",
        "about:blank"
      );
    }

    pendingGame = null;
    gameLoading = false;

    clearGameError();

    setGameLoading(false);

    if (gameView) {
      gameView.hidden = true;
    }

    document.body.classList.remove(
      "game-open"
    );

    setText(
      $("#gameTitle"),
      "Game"
    );

    setText(
      $("#gameStatus"),
      ""
    );

    /*
     * Return focus to the element
     * that launched the game.
     */

    if (
      previousFocus &&
      typeof previousFocus.focus ===
        "function"
    ) {
      try {
        previousFocus.focus();
      } catch {
        // Ignore focus errors.
      }
    }

    previousFocus = null;

    try {
      history.replaceState(
        null,
        "",
        "#library"
      );
    } catch {
      // Ignore history errors.
    }
  }

  /*
   * ------------------------------------------------------------
   * GAME VIEW BUTTONS
   * ------------------------------------------------------------
   */

  function setupGameControls() {
    const close =
      $("#gameClose");

    if (close) {
      close.addEventListener(
        "click",
        () => {
          exitGame(false);
        }
      );
    }

    const reload =
      $("#gameReload");

    if (reload) {
      reload.addEventListener(
        "click",
        () => {
          reloadGame();
        }
      );
    }

    const fullscreen =
      $("#gameFullscreen");

    if (fullscreen) {
      fullscreen.addEventListener(
        "click",
        () => {
          requestGameFullscreen();
        }
      );
    }

    if (frame) {
      frame.addEventListener(
        "load",
        handleGameLoad
      );

      frame.addEventListener(
        "error",
        handleGameError
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * KEYBOARD SHORTCUTS
   * ------------------------------------------------------------
   */

  function setupKeyboard() {
    document.addEventListener(
      "keydown",
      event => {
        /*
         * Escape
         */

        if (
          event.key === "Escape"
        ) {
          if (pendingGame) {
            exitGame(false);
            return;
          }
        }

        /*
         * Ctrl/Cmd + K
         * Focus search.
         */

        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() === "k"
        ) {
          event.preventDefault();

          const search =
            $("#gameSearch");

          if (search) {
            search.focus();
          }

          return;
        }

        /*
         * R while playing
         */

        if (
          pendingGame &&
          event.key.toLowerCase() === "r" &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          const target =
            event.target;

          const typing =
            target &&
            (
              target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable
            );

          if (!typing) {
            event.preventDefault();
            reloadGame();
          }
        }
      }
    );
  }

  /*
   * ------------------------------------------------------------
   * HASH ROUTING
   * ------------------------------------------------------------
   */

  function handleHash() {
    const hash =
      window.location.hash
        .replace(/^#/, "");

    if (!hash) {
      showPage("library");
      return;
    }

    if (
      hash.startsWith("game/")
    ) {
      const id =
        decodeURIComponent(
          hash.slice(5)
        );

      const game =
        getGameById(id);

      if (game) {
        launch(game);
        return;
      }

      showPage("library");
      return;
    }

    const allowedPages = new Set([
      "library",
      "discover",
      "updates",
      "settings",
      "about"
    ]);

    if (
      allowedPages.has(hash)
    ) {
      showPage(hash);
    } else {
      showPage("library");
    }
  }

  /*
   * ------------------------------------------------------------
   * ABOUT
   * ------------------------------------------------------------
   */

  function renderAbout() {
    setText(
      $("#gameCount"),
      games.length
    );

    setText(
      $("#favoriteCount"),
      state.favorites.length
    );

    setText(
      $("#recentCount"),
      state.recent.length
    );
  }

  /*
   * ------------------------------------------------------------
   * GLOBAL RENDER
   * ------------------------------------------------------------
   */

  function renderAll() {
    renderLibrary();
    renderRecent();
    renderFavorites();
    renderDiscover();
    renderUpdates();
    renderAbout();
    applyPreferences();
  }

  /*
   * ------------------------------------------------------------
   * LOADING / EMPTY STATE
   * ------------------------------------------------------------
   */

  function showLauncherError(error) {
    console.error(
      "VoidForge launcher error:",
      error
    );

    if (viewRoot) {
      viewRoot.innerHTML = "";

      const wrapper =
        el(
          "div",
          "launcher-error"
        );

      const title =
        el(
          "h2",
          "",
          "VoidForge could not load"
        );

      const message =
        el(
          "p",
          "",
          error.message ||
            "Unknown launcher error."
        );

      const retry =
        button(
          "Retry",
          "",
          () => {
            window.location.reload();
          }
        );

      wrapper.appendChild(title);
      wrapper.appendChild(message);
      wrapper.appendChild(retry);

      viewRoot.appendChild(wrapper);
    }
  }

  /*
   * ------------------------------------------------------------
   * SERVICE WORKER
   * ------------------------------------------------------------
   */

  async function registerServiceWorker() {
    if (
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    try {
      await navigator.serviceWorker.register(
        "./sw.js"
      );

      console.debug(
        "VoidForge service worker registered."
      );
    } catch (error) {
      console.warn(
        "Service worker registration failed:",
        error
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * INIT
   * ------------------------------------------------------------
   */

  async function init() {
    try {
      applyPreferences();

      setupNavigation();
      setupSearch();
      setupFilters();
      setupSettings();
      setupGameControls();
      setupKeyboard();

      games =
        await fetchGames();

      /*
       * If saved selected game no longer exists,
       * select the first available game.
       */

      if (
        state.selectedId &&
        !getGameById(
          state.selectedId
        )
      ) {
        state.selectedId =
          games[0]?.id || null;
      }

      /*
       * Clean favorites.
       */

      state.favorites =
        state.favorites.filter(
          id => Boolean(
            getGameById(id)
          )
        );

      /*
       * Clean recent games.
       */

      state.recent =
        state.recent.filter(
          id => Boolean(
            getGameById(id)
          )
        );

      saveState();

      renderAll();

      handleHash();

      /*
       * Don't register service worker
       * when running from file://.
       */

      if (
        location.protocol === "http:" ||
        location.protocol === "https:"
      ) {
        registerServiceWorker();
      }
    } catch (error) {
      showLauncherError(error);
    }
  }

  /*
   * ------------------------------------------------------------
   * BROWSER NAVIGATION
   * ------------------------------------------------------------
   */

  window.addEventListener(
    "popstate",
    () => {
      if (
        pendingGame &&
        !window.location.hash.startsWith(
          "#game/"
        )
      ) {
        exitGame(true);
      }

      handleHash();
    }
  );

  window.addEventListener(
    "hashchange",
    () => {
      handleHash();
    }
  );

  /*
   * ------------------------------------------------------------
   * START
   * ------------------------------------------------------------
   */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }

})();
