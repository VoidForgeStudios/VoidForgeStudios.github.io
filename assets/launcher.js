/* VoidForge Launcher */

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const gameFrame = $("#gameFrame");
  const gameView = $("#gameView");
  const gameLoader = $("#gameLoader");
  const gameError = $("#gameError");

  const gameTitle =
    $("#gameTitle") ||
    $("#playingGameTitle");

  const gameStatus =
    $("#gameStatus") ||
    $("#gameLoadStatus");

  const closeButton =
    $("#gameClose") ||
    $("#exitGame");

  let games = [];
  let currentGame = null;

  function showToast(message) {
    const region = $("#toastRegion");
    if (!region) return;

    const toast = document.createElement("p");
    toast.className = "toast";
    toast.textContent = message;

    region.replaceChildren(toast);

    window.setTimeout(() => toast.remove(), 3500);
  }

  /* -------------------------
     Helpers
     ------------------------- */

  function normalizeFolder(entry) {
    return String(entry || "")
      .trim()
      .replace(/^\.\/+/, "")
      .replace(/\/+$/, "");
  }

  function gameUrl(game) {
    const folder = normalizeFolder(game.entry);

    if (!folder) {
      throw new Error("Game entry is missing.");
    }

    return `./${folder}/index.html`;
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value;
    }
  }

  function showLoader(show) {
    if (gameLoader) {
      gameLoader.hidden = !show;
    }
  }

  function showError(message) {
    if (!gameError) return;

    gameError.hidden = !message;

    if (message) {
      gameError.textContent = message;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* -------------------------
     Game registry
     ------------------------- */

  async function getRegistryPath() {
    const embeddedRegistry = $("#embeddedGameRegistry");

    // Default registry location.
    let registryPath = "/games.json";

    if (!embeddedRegistry) {
      return registryPath;
    }

    const raw = embeddedRegistry.textContent.trim();

    if (!raw) {
      return registryPath;
    }

    try {
      const value = JSON.parse(raw);

      // Supports:
      //
      // "./games.json"
      //
      // or:
      //
      // {"source":"./games.json"}
      //
      // or the old embedded array format.
      if (typeof value === "string") {
        return value;
      }

      if (
        value &&
        typeof value === "object" &&
        typeof value.source === "string"
      ) {
        return value.source;
      }

      // If it's an array, it's the old embedded registry format.
      // Return null so loadGames() can use it as a fallback.
      if (Array.isArray(value)) {
        return null;
      }
    } catch (error) {
      console.warn(
        "VoidForge: embedded game registry is not valid JSON.",
        error
      );
    }

    return registryPath;
  }

  function getEmbeddedGames() {
    const embeddedRegistry = $("#embeddedGameRegistry");

    if (!embeddedRegistry) {
      return [];
    }

    try {
      const value = JSON.parse(
        embeddedRegistry.textContent.trim()
      );

      if (Array.isArray(value)) {
        return value;
      }
    } catch (error) {
      console.warn(
        "VoidForge: could not parse embedded game registry.",
        error
      );
    }

    return [];
  }

  function validateGames(data) {
    const registry = Array.isArray(data)
      ? data
      : Array.isArray(data?.games)
        ? data.games
        : [];

    return registry.filter((game) => {
      if (!game || typeof game !== "object") {
        return false;
      }

      if (!game.id) {
        return false;
      }

      if (!game.entry) {
        return false;
      }

      return Boolean(normalizeFolder(game.entry));
    });
  }

  async function loadGames() {
    let registryPath = "./games.json";

    try {
      registryPath = await getRegistryPath();

      // If the HTML contains an old-style embedded array,
      // use that directly.
      if (!registryPath) {
        games = validateGames(getEmbeddedGames());

        console.log(
          "VoidForge games loaded from embedded registry:",
          games
        );

        renderGames();
        return;
      }

      const response = await fetch(registryPath, {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(
          `${registryPath} returned HTTP ${response.status}`
        );
      }

      const data = await response.json();

      games = validateGames(data);

      console.log(
        `VoidForge games loaded from ${registryPath}:`,
        games
      );

      renderGames();
    } catch (error) {
      console.error(
        "VoidForge: could not load game registry:",
        error
      );

      // If games.json fails, try the old embedded array.
      const embeddedGames = validateGames(getEmbeddedGames());

      if (embeddedGames.length) {
        games = embeddedGames;

        console.warn(
          "VoidForge: using embedded game registry fallback."
        );

        renderGames();

        showToast(
          "Using embedded game registry because games.json could not be loaded."
        );

        return;
      }

      games = [];

      renderGames();

      showToast(
        "Could not load games.json. Make sure the file exists."
      );
    }
  }

  /* -------------------------
     Library rendering
     ------------------------- */

  function renderGames() {
    const root = $("#viewRoot");

    if (!root) {
      return;
    }

    const query =
      $("#gameSearch")?.value.trim().toLowerCase() || "";

    const visibleGames = games.filter((game) => {
      const searchableText = [
        game.name,
        game.subtitle,
        game.description,
        ...(Array.isArray(game.tags) ? game.tags : [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });

    root.innerHTML = `
      <section class="library-view">

        <div class="view-heading">
          <div>
            <p class="eyebrow">VOIDFORGE LIBRARY</p>

            <h1>Your games</h1>

            <p class="view-subtitle">
              ${games.length}
              browser game${games.length === 1 ? "" : "s"}
              ready to play.
            </p>
          </div>

          <button
            class="primary-button"
            id="refreshGames"
            type="button"
          >
            ↻ Refresh library
          </button>
        </div>

        <div class="game-grid" id="gameGrid">

          ${
            visibleGames.length
              ? visibleGames
                  .map((game, index) => {
                    const gameIndex = games.indexOf(game);

                    const name =
                      game.name ||
                      `Game ${index + 1}`;

                    const initial =
                      name.slice(0, 1);

                    const status =
                      game.status ||
                      "Available";

                    const platform =
                      game.platform ||
                      "Browser";

                    const version =
                      game.version ||
                      "";

                    const description =
                      game.description ||
                      "Ready to launch.";

                    const tags =
                      Array.isArray(game.tags)
                        ? game.tags
                        : [];

                    return `
                      <article class="game-card">

                        <div class="game-art">
                          <span>
                            ${escapeHtml(initial)}
                          </span>

                          <b>
                            ${escapeHtml(status)}
                          </b>
                        </div>

                        <div class="game-card-body">

                          <p class="eyebrow">
                            ${escapeHtml(platform)}
                            ${version ? " · " : ""}
                            ${escapeHtml(version)}
                          </p>

                          <h2>
                            ${escapeHtml(name)}
                          </h2>

                          <p>
                            ${escapeHtml(description)}
                          </p>

                          ${
                            tags.length
                              ? `
                                <div class="tag-row">
                                  ${tags
                                    .map(
                                      (tag) =>
                                        `<span>${escapeHtml(tag)}</span>`
                                    )
                                    .join("")}
                                </div>
                              `
                              : ""
                          }

                          <button
                            class="play-button"
                            type="button"
                            data-game-index="${gameIndex}"
                          >
                            Play now
                            <span>→</span>
                          </button>

                        </div>
                      </article>
                    `;
                  })
                  .join("")
              : `
                <div class="empty-state">
                  <h2>No games found</h2>
                  <p>
                    ${
                      query
                        ? "Try a different search."
                        : "Your game library is empty."
                    }
                  </p>
                </div>
              `
          }

        </div>
      </section>
    `;

    $$("[data-game-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(
          button.dataset.gameIndex
        );

        launchGame(games[index]);
      });
    });

    $("#refreshGames")?.addEventListener(
      "click",
      loadGames
    );
  }

  /* -------------------------
     Launch game
     ------------------------- */

  function launchGame(game) {
    if (!gameFrame || !gameView) {
      console.error(
        "VoidForge: game window not found."
      );
      return;
    }

    if (!game || !game.entry) {
      showError(
        "This game does not have a valid entry folder."
      );
      return;
    }

    currentGame = game;

    let url;

    try {
      url = gameUrl(game);
    } catch (error) {
      showError(error.message);
      return;
    }

    setText(
      gameTitle,
      game.name || "Loading game"
    );

    setText(
      gameStatus,
      "Loading game…"
    );

    showError("");
    showLoader(true);

    gameView.hidden = false;

    document.body.classList.add(
      "game-open"
    );

    gameFrame.src = url;
  }

  function closeGame() {
    if (gameFrame) {
      gameFrame.src = "about:blank";
    }

    if (gameView) {
      gameView.hidden = true;
    }

    document.body.classList.remove(
      "game-open"
    );

    currentGame = null;

    showLoader(false);
    showError("");
  }

  function reloadGame() {
    if (!currentGame || !gameFrame) {
      return;
    }

    showError("");
    showLoader(true);

    setText(
      gameStatus,
      "Reloading game…"
    );

    try {
      gameFrame.src = gameUrl(
        currentGame
      );
    } catch (error) {
      showLoader(false);
      showError(error.message);
    }
  }

  /* -------------------------
     Game window events
     ------------------------- */

  function setupGameWindow() {
    gameFrame?.addEventListener(
      "load",
      () => {
        showLoader(false);
        showError("");

        setText(
          gameStatus,
          "Game ready"
        );
      }
    );

    gameFrame?.addEventListener(
      "error",
      () => {
        showLoader(false);

        setText(
          gameStatus,
          "Game failed to load"
        );

        showError(
          "Could not load the game. Make sure its folder contains index.html."
        );
      }
    );

    closeButton?.addEventListener(
      "click",
      closeGame
    );

    $("#reloadGame")?.addEventListener(
      "click",
      reloadGame
    );

    $("#gameFullscreen")?.addEventListener(
      "click",
      () => {
        const stage =
          document.querySelector(
            ".game-stage"
          );

        if (!stage) {
          return;
        }

        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        } else {
          stage
            .requestFullscreen?.()
            .catch(() =>
              showToast(
                "Fullscreen is unavailable in this browser."
              )
            );
        }
      }
    );

    $("#gameInfo")?.addEventListener(
      "click",
      () => {
        if (!currentGame) {
          return;
        }

        const version =
          currentGame.version
            ? ` ${currentGame.version}`
            : "";

        const description =
          currentGame.description ||
          "Ready to play.";

        showToast(
          `${currentGame.name || "Game"}${version} · ${description}`
        );
      }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          gameView &&
          !gameView.hidden
        ) {
          if (document.fullscreenElement) {
            document.exitFullscreen?.();
          } else {
            closeGame();
          }
        }
      }
    );
  }

  /* -------------------------
     Launcher navigation
     ------------------------- */

  function setupLauncher() {
    const navItems =
      $$("[data-view]");

    navItems.forEach((item) => {
      item.addEventListener(
        "click",
        () => {
          navItems.forEach((nav) => {
            nav.classList.toggle(
              "is-active",
              nav.dataset.view ===
                item.dataset.view
            );
          });

          document.body.classList.remove(
            "nav-open"
          );

          const view =
            item.dataset.view;

          if (
            view === "library" ||
            view === "discover"
          ) {
            renderGames();
          } else if (
            view === "updates"
          ) {
            renderSimpleView(
              "Updates",
              "Your library is up to date."
            );
          } else if (
            view === "about"
          ) {
            renderSimpleView(
              "About VoidForge",
              "A small collection of browser games, built for the open web."
            );
          } else {
            renderSimpleView(
              "Settings",
              "Launcher settings are ready for your next session."
            );
          }
        }
      );
    });

    $("#gameSearch")?.addEventListener(
      "input",
      renderGames
    );

    $("#fullscreenLauncher")?.addEventListener(
      "click",
      () => {
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        } else {
          document.documentElement
            .requestFullscreen?.()
            .catch(() =>
              showToast(
                "Fullscreen is unavailable in this browser."
              )
            );
        }
      }
    );

    $("#mobileMenu")?.addEventListener(
      "click",
      () => {
        const open =
          document.body.classList.toggle(
            "nav-open"
          );

        $("#mobileMenu")?.setAttribute(
          "aria-expanded",
          String(open)
        );
      }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "/" &&
          document.activeElement?.tagName !==
            "INPUT" &&
          document.activeElement?.tagName !==
            "TEXTAREA"
        ) {
          event.preventDefault();

          $("#gameSearch")?.focus();
        }
      }
    );

    setText(
      $("#connectionStatus"),
      navigator.onLine
        ? "Online"
        : "Offline mode"
    );

    window.addEventListener(
      "online",
      () => {
        setText(
          $("#connectionStatus"),
          "Online"
        );
      }
    );

    window.addEventListener(
      "offline",
      () => {
        setText(
          $("#connectionStatus"),
          "Offline mode"
        );
      }
    );
  }

  /* -------------------------
     Service worker
     ------------------------- */

  function registerServiceWorker() {
    if (
      !("serviceWorker" in navigator) ||
      !["http:", "https:"].includes(
        location.protocol
      )
    ) {
      return;
    }

    navigator.serviceWorker
      .register("./sw.js", {
        scope: "./"
      })
      .catch((error) => {
        console.warn(
          "VoidForge offline support is unavailable:",
          error
        );
      });
  }

  /* -------------------------
     Simple views
     ------------------------- */

  function renderSimpleView(
    title,
    subtitle
  ) {
    const root = $("#viewRoot");

    if (!root) {
      return;
    }

    root.innerHTML = `
      <section class="library-view simple-view">
        <p class="eyebrow">
          VOIDFORGE STUDIOS
        </p>

        <h1>
          ${escapeHtml(title)}
        </h1>

        <p class="view-subtitle">
          ${escapeHtml(subtitle)}
        </p>
      </section>
    `;
  }

  /* -------------------------
     Public launcher API
     ------------------------- */

  window.launchGame = launchGame;
  window.launch = launchGame;

  window.VoidForge = {
    get games() {
      return games;
    },

    launchGame,
    closeGame,
    reloadGame,
    gameUrl,
    loadGames
  };

  /* -------------------------
     Start
     ------------------------- */

  setupGameWindow();
  setupLauncher();
  registerServiceWorker();
  loadGames();

})();
