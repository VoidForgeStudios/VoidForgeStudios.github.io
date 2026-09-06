(() => {
  "use strict";

  /* =========================================================
     DOM HELPERS
  ========================================================= */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector)
  ];

  /* =========================================================
     GAME VIEW
  ========================================================= */

  const gameView = $("#gameView");
  const gameFrame = $("#gameFrame");
  const gameLoader = $("#gameLoader");
  const gameError = $("#gameError");

  const gameTitle = $("#gameTitle");
  const gameStatus = $("#gameStatus");
  const gameInfo = $("#gameInfo");

  const reloadButton = $("#reloadGame");
  const fullscreenButton = $("#gameFullscreen");
  const closeButton =
    $("#gameClose") ||
    $("#gameCloseButton") ||
    $('[data-action="close-game"]');

  /* =========================================================
     STATE
  ========================================================= */

  let games = [];
  let currentGame = null;

  /* =========================================================
     TOAST
  ========================================================= */

  function showToast(message, duration = 3000) {
    let toast = $("#vfToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "vfToast";
      toast.className = "vf-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toast._timeout);

    toast._timeout = setTimeout(() => {
      toast.classList.remove("show");
    }, duration);
  }

  /* =========================================================
     GAME HELPERS
  ========================================================= */

  function normalizeFolder(entry) {
    if (!entry) return "";

    return String(entry)
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
  }

  function gameUrl(game) {
    const folder = normalizeFolder(game?.entry);

    if (!folder) {
      return "";
    }

    return `./${folder}/index.html`;
  }

  function setText(element, value) {
    if (!element) return;

    element.textContent =
      value === undefined || value === null ? "" : String(value);
  }

  function showLoader(show) {
    if (!gameLoader) return;

    gameLoader.hidden = !show;
  }

  function showError(message) {
    if (!gameError) return;

    gameError.hidden = false;

    const messageElement =
      $("#gameErrorMessage", gameError) ||
      $(".game-error-message", gameError) ||
      $("p", gameError);

    if (messageElement) {
      messageElement.textContent = message;
    } else {
      gameError.textContent = message;
    }
  }

  function hideError() {
    if (!gameError) return;

    gameError.hidden = true;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* =========================================================
     GAME REGISTRY
     
     Primary source:
       /games.json
  ========================================================= */

  function validateGames(data) {
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.games)
        ? data.games
        : null;

    if (!list) {
      throw new Error("games.json must contain an array of games.");
    }

    return list.filter((game) => {
      return (
        game &&
        typeof game === "object" &&
        game.id &&
        game.entry
      );
    });
  }

  function getEmbeddedGames() {
    const embedded = $("#embeddedGameRegistry");

    if (!embedded) {
      return null;
    }

    try {
      const parsed = JSON.parse(embedded.textContent.trim());

      if (Array.isArray(parsed)) {
        return validateGames(parsed);
      }

      return null;
    } catch {
      return null;
    }
  }

  async function loadGames() {
    try {
      /*
       * Always load the registry from the website root.
       *
       * Example:
       * https://your-domain.com/games.json
       */
      const response = await fetch("/games.json", {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(
          `Unable to load games.json (${response.status})`
        );
      }

      const data = await response.json();

      games = validateGames(data);

      console.log(
        `[VoidForge] Loaded ${games.length} game(s) from /games.json`
      );

      renderGames();

      return games;
    } catch (error) {
      console.error("[VoidForge] Failed to load /games.json:", error);

      /*
       * Backwards-compatible fallback.
       *
       * This only works if #embeddedGameRegistry contains
       * an actual JSON array of games.
       */
      const fallbackGames = getEmbeddedGames();

      if (fallbackGames && fallbackGames.length) {
        games = fallbackGames;

        console.warn(
          "[VoidForge] Using embedded game registry fallback."
        );

        renderGames();

        showToast(
          "Using the embedded game registry because games.json could not be loaded."
        );

        return games;
      }

      games = [];

      renderGames();

      showToast("Unable to load the game library.");

      return [];
    }
  }

  /* =========================================================
     GAME CARD RENDERING
  ========================================================= */

  function renderGames() {
    const containers = [
      $("#gamesGrid"),
      $("#gameGrid"),
      $("#libraryGrid"),
      $(".games-grid"),
      $(".game-grid")
    ].filter(Boolean);

    if (!containers.length) {
      return;
    }

    containers.forEach((container) => {
      renderGameList(container);
    });
  }

  function renderGameList(container, searchTerm = "") {
    if (!container) return;

    const query = String(searchTerm || "")
      .trim()
      .toLowerCase();

    const filteredGames = games.filter((game) => {
      if (!query) return true;

      const searchable = [
        game.name,
        game.title,
        game.subtitle,
        game.description,
        game.category,
        game.platform,
        ...(Array.isArray(game.tags) ? game.tags : [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    if (!filteredGames.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No games found</h3>
          <p>
            ${
              query
                ? "Try a different search."
                : "No games are currently available."
            }
          </p>
        </div>
      `;

      return;
    }

    container.innerHTML = filteredGames
      .map((game) => {
        const tags = Array.isArray(game.tags)
          ? game.tags
          : [];

        const title =
          game.name ||
          game.title ||
          game.id;

        const subtitle =
          game.subtitle ||
          game.description ||
          "";

        const status =
          game.status ||
          "Available";

        const platform =
          game.platform ||
          "Browser";

        const id = escapeHtml(game.id);

        return `
          <article
            class="game-card"
            data-game-id="${id}"
          >
            ${
              game.image || game.thumbnail || game.cover
                ? `
                  <div class="game-card-image">
                    <img
                      src="${escapeHtml(
                        game.image ||
                        game.thumbnail ||
                        game.cover
                      )}"
                      alt="${escapeHtml(title)}"
                      loading="lazy"
                    >
                  </div>
                `
                : `
                  <div class="game-card-image game-card-placeholder">
                    <span>
                      ${escapeHtml(title.charAt(0).toUpperCase())}
                    </span>
                  </div>
                `
            }

            <div class="game-card-content">
              <div class="game-card-header">
                <div>
                  <h3 class="game-card-title">
                    ${escapeHtml(title)}
                  </h3>

                  ${
                    subtitle
                      ? `
                        <p class="game-card-subtitle">
                          ${escapeHtml(subtitle)}
                        </p>
                      `
                      : ""
                  }
                </div>

                <span class="game-status">
                  ${escapeHtml(status)}
                </span>
              </div>

              ${
                game.description
                  ? `
                    <p class="game-card-description">
                      ${escapeHtml(game.description)}
                    </p>
                  `
                  : ""
              }

              ${
                tags.length
                  ? `
                    <div class="game-tags">
                      ${tags
                        .map(
                          (tag) => `
                            <span class="game-tag">
                              ${escapeHtml(tag)}
                            </span>
                          `
                        )
                        .join("")}
                    </div>
                  `
                  : ""
              }

              <div class="game-card-footer">
                <span class="game-platform">
                  ${escapeHtml(platform)}
                </span>

                <button
                  type="button"
                  class="play-game"
                  data-game-id="${id}"
                >
                  Play now
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    $$(".play-game", container).forEach((button) => {
      button.addEventListener("click", () => {
        const gameId = button.dataset.gameId;

        launchGame(gameId);
      });
    });

    $$(".game-card", container).forEach((card) => {
      card.addEventListener("dblclick", () => {
        const gameId = card.dataset.gameId;

        launchGame(gameId);
      });
    });
  }

  /* =========================================================
     LAUNCH GAME
  ========================================================= */

  function launchGame(gameOrId) {
    let game = gameOrId;

    if (
      typeof gameOrId === "string" ||
      typeof gameOrId === "number"
    ) {
      game = games.find(
        (item) => String(item.id) === String(gameOrId)
      );
    }

    if (!game) {
      showToast("Game not found.");
      return;
    }

    const url = gameUrl(game);

    if (!url) {
      showToast("This game does not have a valid entry path.");
      return;
    }

    currentGame = game;

    setText(
      gameTitle,
      game.name ||
        game.title ||
        game.id ||
        "Game"
    );

    setText(
      gameStatus,
      game.status || "Available"
    );

    if (gameInfo) {
      const infoParts = [];

      if (game.subtitle) {
        infoParts.push(game.subtitle);
      }

      if (game.version) {
        infoParts.push(`v${game.version}`);
      }

      if (game.platform) {
        infoParts.push(game.platform);
      }

      gameInfo.textContent = infoParts.join(" • ");
    }

    hideError();
    showLoader(true);

    if (gameView) {
      gameView.hidden = false;
      gameView.classList.add("active");
    }

    document.body.classList.add("game-open");

    if (gameFrame) {
      gameFrame.src = url;
    }

    window.dispatchEvent(
      new CustomEvent("voidforge:game-launch", {
        detail: game
      })
    );
  }

  /* =========================================================
     CLOSE GAME
  ========================================================= */

  function closeGame() {
    currentGame = null;

    if (gameFrame) {
      gameFrame.src = "about:blank";
    }

    if (gameView) {
      gameView.classList.remove("active");
      gameView.hidden = true;
    }

    document.body.classList.remove("game-open");

    showLoader(false);
    hideError();

    window.dispatchEvent(
      new CustomEvent("voidforge:game-close")
    );
  }

  /* =========================================================
     RELOAD GAME
  ========================================================= */

  function reloadGame() {
    if (!gameFrame || !currentGame) {
      return;
    }

    const url = gameUrl(currentGame);

    if (!url) {
      showToast("Unable to reload this game.");
      return;
    }

    hideError();
    showLoader(true);

    /*
     * Reassigning src forces the iframe to reload.
     */
    gameFrame.src = url;
  }

  /* =========================================================
     GAME WINDOW EVENTS
  ========================================================= */

  function setupGameEvents() {
    if (gameFrame) {
      gameFrame.addEventListener("load", () => {
        showLoader(false);
        hideError();
      });

      gameFrame.addEventListener("error", () => {
        showLoader(false);

        showError(
          "The game could not be loaded. Please check the game folder and try again."
        );
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", closeGame);
    }

    if (reloadButton) {
      reloadButton.addEventListener("click", reloadGame);
    }

    if (fullscreenButton) {
      fullscreenButton.addEventListener("click", async () => {
        if (!gameFrame) return;

        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
          } else {
            await gameFrame.requestFullscreen();
          }
        } catch (error) {
          console.error(
            "[VoidForge] Fullscreen error:",
            error
          );

          showToast("Fullscreen is not available.");
        }
      });
    }

    if (gameInfo) {
      gameInfo.addEventListener("click", () => {
        if (!currentGame) return;

        const description =
          currentGame.description ||
          currentGame.subtitle ||
          "No additional information is available.";

        showToast(description, 5000);
      });
    }
  }

  /* =========================================================
     ESCAPE KEY
  ========================================================= */

  function setupKeyboardEvents() {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          return;
        }

        if (
          currentGame &&
          gameView &&
          !gameView.hidden
        ) {
          closeGame();
        }
      }

      /*
       * "/" focuses search when the user isn't typing.
       */
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const activeElement = document.activeElement;

        const isTyping =
          activeElement &&
          (
            activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable
          );

        if (!isTyping) {
          const searchInput =
            $("#searchInput") ||
            $("#gameSearch") ||
            $('input[type="search"]');

          if (searchInput) {
            event.preventDefault();
            searchInput.focus();
          }
        }
      }
    });
  }

  /* =========================================================
     NAVIGATION
  ========================================================= */

  function setupNavigation() {
    const navItems = $$(
      "[data-view], [data-nav]"
    );

    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        const view =
          item.dataset.view ||
          item.dataset.nav;

        if (!view) return;

        navItems.forEach((nav) => {
          nav.classList.remove("active");
          nav.setAttribute("aria-current", "false");
        });

        item.classList.add("active");
        item.setAttribute("aria-current", "page");

        renderView(view);
      });
    });
  }

  function renderView(view) {
    const viewRoot = $("#viewRoot");

    if (!viewRoot) return;

    switch (String(view).toLowerCase()) {
      case "library":
      case "home":
        renderLibraryView(viewRoot);
        break;

      case "discover":
        renderDiscoverView(viewRoot);
        break;

      case "updates":
        renderUpdatesView(viewRoot);
        break;

      case "about":
        renderAboutView(viewRoot);
        break;

      case "settings":
        renderSettingsView(viewRoot);
        break;

      default:
        renderLibraryView(viewRoot);
        break;
    }
  }

  function renderLibraryView(root) {
    root.innerHTML = `
      <section class="launcher-view library-view">
        <div class="view-heading">
          <div>
            <h1>Library</h1>
            <p>Your VoidForge games.</p>
          </div>
        </div>

        <div
          id="gamesGrid"
          class="games-grid"
        ></div>
      </section>
    `;

    renderGames();
  }

  function renderDiscoverView(root) {
    root.innerHTML = `
      <section class="launcher-view discover-view">
        <div class="view-heading">
          <div>
            <h1>Discover</h1>
            <p>Explore the games available in VoidForge.</p>
          </div>
        </div>

        <div
          id="gamesGrid"
          class="games-grid"
        ></div>
      </section>
    `;

    renderGames();
  }

  function renderUpdatesView(root) {
    root.innerHTML = `
      <section class="launcher-view">
        <div class="view-heading">
          <div>
            <h1>Updates</h1>
            <p>Latest VoidForge updates.</p>
          </div>
        </div>

        <div class="empty-state">
          <h3>You're up to date</h3>
          <p>
            No new launcher updates are available.
          </p>
        </div>
      </section>
    `;
  }

  function renderAboutView(root) {
    root.innerHTML = `
      <section class="launcher-view">
        <div class="view-heading">
          <div>
            <h1>About VoidForge</h1>
            <p>VoidForge Studios browser game launcher.</p>
          </div>
        </div>

        <div class="about-content">
          <p>
            VoidForge is a browser-based game launcher
            built for VoidForge Studios.
          </p>

          <p>
            Games are loaded dynamically from
            <code>/games.json</code>.
          </p>
        </div>
      </section>
    `;
  }

  function renderSettingsView(root) {
    root.innerHTML = `
      <section class="launcher-view">
        <div class="view-heading">
          <div>
            <h1>Settings</h1>
            <p>Launcher settings.</p>
          </div>
        </div>

        <div class="settings-content">
          <p>
            Launcher settings will appear here.
          </p>
        </div>
      </section>
    `;
  }

  /* =========================================================
     SEARCH
  ========================================================= */

  function setupSearch() {
    const searchInput =
      $("#searchInput") ||
      $("#gameSearch") ||
      $('input[type="search"]');

    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
      const value = searchInput.value;

      const grids = [
        $("#gamesGrid"),
        $("#gameGrid"),
        $("#libraryGrid")
      ].filter(Boolean);

      grids.forEach((grid) => {
        renderGameList(grid, value);
      });
    });
  }

  /* =========================================================
     LAUNCHER FULLSCREEN
  ========================================================= */

  function setupLauncherFullscreen() {
    const buttons = $$(
      '[data-action="fullscreen"], #fullscreenButton, #launcherFullscreen'
    );

    buttons.forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
          } else {
            await document.documentElement.requestFullscreen();
          }
        } catch (error) {
          console.error(
            "[VoidForge] Launcher fullscreen error:",
            error
          );

          showToast(
            "Launcher fullscreen is not available."
          );
        }
      });
    });
  }

  /* =========================================================
     MOBILE MENU
  ========================================================= */

  function setupMobileMenu() {
    const menuButton =
      $("#mobileMenuButton") ||
      $("#menuButton") ||
      $('[data-action="menu"]');

    const sidebar =
      $("#sidebar") ||
      $(".sidebar");

    if (!menuButton || !sidebar) {
      return;
    }

    menuButton.addEventListener("click", () => {
      sidebar.classList.toggle("open");

      menuButton.setAttribute(
        "aria-expanded",
        sidebar.classList.contains("open")
          ? "true"
          : "false"
      );
    });

    $$(
      "[data-view], [data-nav]",
      sidebar
    ).forEach((item) => {
      item.addEventListener("click", () => {
        sidebar.classList.remove("open");
      });
    });
  }

  /* =========================================================
     CONNECTION STATUS
  ========================================================= */

  function setupConnectionStatus() {
    const updateConnectionStatus = () => {
      const statusElements = $$(
        "#connectionStatus, .connection-status, [data-connection-status]"
      );

      statusElements.forEach((element) => {
        if (navigator.onLine) {
          element.textContent = "Online";
          element.classList.remove("offline");
          element.classList.add("online");
        } else {
          element.textContent = "Offline";
          element.classList.remove("online");
          element.classList.add("offline");
        }
      });
    };

    window.addEventListener(
      "online",
      updateConnectionStatus
    );

    window.addEventListener(
      "offline",
      updateConnectionStatus
    );

    updateConnectionStatus();
  }

  /* =========================================================
     SERVICE WORKER
  ========================================================= */

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    try {
      const registration =
        await navigator.serviceWorker.register(
          "./sw.js"
        );

      console.log(
        "[VoidForge] Service worker registered:",
        registration.scope
      );
    } catch (error) {
      console.warn(
        "[VoidForge] Service worker registration failed:",
        error
      );
    }
  }

  /* =========================================================
     GLOBAL API
  ========================================================= */

  window.launchGame = launchGame;

  window.launch = launchGame;

  window.VoidForge = {
    get games() {
      return games;
    },

    get currentGame() {
      return currentGame;
    },

    loadGames,
    renderGames,
    launchGame,
    closeGame,
    reloadGame
  };

  /* =========================================================
     STARTUP
  ========================================================= */

  async function init() {
    setupGameEvents();
    setupKeyboardEvents();
    setupNavigation();
    setupSearch();
    setupLauncherFullscreen();
    setupMobileMenu();
    setupConnectionStatus();

    /*
     * Load the registry from:
     *
     * /games.json
     */
    await loadGames();

    registerServiceWorker();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
