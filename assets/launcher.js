/* VoidForge Launcher - Multi Game Support */

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
    if (element) element.textContent = value;
  }

  function showLoader(show) {
    if (gameLoader) gameLoader.hidden = !show;
  }

  function showError(message) {
    if (!gameError) return;

    gameError.hidden = !message;

    if (message) {
      gameError.textContent = message;
    }
  }

  /* -------------------------
     Game loading
     ------------------------- */

  async function loadGames() {
    try {
      const response = await fetch("./games.json", {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(`games.json returned ${response.status}`);
      }

      const data = await response.json();

      games = Array.isArray(data)
        ? data
        : Array.isArray(data.games)
          ? data.games
          : [];

      console.log("VoidForge games:", games);

      renderGames();
    } catch (error) {
      console.error("Could not load games.json:", error);
    }
  }

  function renderGames() {
    const root = $("#viewRoot");
    if (!root) return;

    const query = $("#gameSearch")?.value.trim().toLowerCase() || "";
    const visibleGames = games.filter(game =>
      [game.name, game.subtitle, game.description, ...(game.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );

    root.innerHTML = `
      <section class="library-view">
        <div class="view-heading">
          <div><p class="eyebrow">VOIDFORGE LIBRARY</p><h1>Your games</h1><p class="view-subtitle">${games.length} browser game${games.length === 1 ? "" : "s"} ready to play.</p></div>
          <button class="primary-button" id="refreshGames" type="button">↻ Refresh library</button>
        </div>
        <div class="game-grid" id="gameGrid">
          ${visibleGames.length ? visibleGames.map((game, index) => `
            <article class="game-card">
              <div class="game-art"><span>${escapeHtml((game.name || "G").slice(0, 1))}</span><b>${escapeHtml(game.status || "Available")}</b></div>
              <div class="game-card-body"><p class="eyebrow">${escapeHtml(game.platform || "Browser")} · ${escapeHtml(game.version || "")}</p><h2>${escapeHtml(game.name || `Game ${index + 1}`)}</h2><p>${escapeHtml(game.description || "Ready to launch.")}</p><div class="tag-row">${(game.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div><button class="play-button" type="button" data-game-index="${games.indexOf(game)}">Play now <span>→</span></button></div>
            </article>`).join("") : `<div class="empty-state"><h2>No games found</h2><p>Try a different search.</p></div>`}
        </div>
      </section>`;

    $$("[data-game-index]").forEach(button => button.addEventListener("click", () => launchGame(games[Number(button.dataset.gameIndex)])));
    $("#refreshGames")?.addEventListener("click", loadGames);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* -------------------------
     Launch game
     ------------------------- */

  function launchGame(game) {
    if (!gameFrame || !gameView) {
      console.error("VoidForge: game window not found.");
      return;
    }

    if (!game || !game.entry) {
      showError("This game does not have a valid entry folder.");
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

    setText(gameTitle, game.name || "Loading game");
    setText(gameStatus, "Loading game…");

    showError("");
    showLoader(true);

    gameView.hidden = false;
    document.body.classList.add("game-open");

    gameFrame.src = url;
  }

  function closeGame() {
    if (gameFrame) {
      gameFrame.src = "about:blank";
    }

    if (gameView) {
      gameView.hidden = true;
    }

    document.body.classList.remove("game-open");

    currentGame = null;

    showLoader(false);
    showError("");
  }

  function reloadGame() {
    if (!currentGame || !gameFrame) return;

    showError("");
    showLoader(true);
    setText(gameStatus, "Reloading game…");

    gameFrame.src = gameUrl(currentGame);
  }

  /* -------------------------
     Game window events
     ------------------------- */

  function setupGameWindow() {
    gameFrame?.addEventListener("load", () => {
      showLoader(false);
      showError("");
      setText(gameStatus, "Game ready");
    });

    gameFrame?.addEventListener("error", () => {
      showLoader(false);
      setText(gameStatus, "Game failed to load");
      showError(
        "Could not load the game. Make sure its folder contains index.html."
      );
    });

    closeButton?.addEventListener("click", closeGame);

    $("#reloadGame")?.addEventListener("click", reloadGame);

    $("#gameFullscreen")?.addEventListener("click", () => {
      const stage = document.querySelector(".game-stage");

      if (!stage) return;

      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        stage.requestFullscreen?.();
      }
    });

    document.addEventListener("keydown", (event) => {
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
    });
  }

  function setupLauncher() {
    const navItems = $$("[data-view]");
    navItems.forEach(item => item.addEventListener("click", () => {
      navItems.forEach(nav => nav.classList.toggle("is-active", nav.dataset.view === item.dataset.view));
      if (item.dataset.view === "library" || item.dataset.view === "discover") renderGames();
      else if (item.dataset.view === "updates") renderSimpleView("Updates", "Your library is up to date.");
      else if (item.dataset.view === "about") renderSimpleView("About VoidForge", "A small collection of browser games, built for the open web.");
      else renderSimpleView("Settings", "Launcher settings are ready for your next session.");
    }));
    $("#gameSearch")?.addEventListener("input", renderGames);
    $("#fullscreenLauncher")?.addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.());
    $("#mobileMenu")?.addEventListener("click", () => document.body.classList.toggle("nav-open"));
    setText($("#connectionStatus"), navigator.onLine ? "Online" : "Offline mode");
    window.addEventListener("online", () => setText($("#connectionStatus"), "Online"));
    window.addEventListener("offline", () => setText($("#connectionStatus"), "Offline mode"));
  }

  function renderSimpleView(title, subtitle) {
    const root = $("#viewRoot");
    if (!root) return;
    root.innerHTML = `<section class="library-view simple-view"><p class="eyebrow">VOIDFORGE STUDIOS</p><h1>${escapeHtml(title)}</h1><p class="view-subtitle">${escapeHtml(subtitle)}</p></section>`;
  }

  /* -------------------------
     Existing launcher support
     ------------------------- */

  /*
   * Your existing HTML can call:
   *
   *   launchGame(game)
   *
   * or:
   *
   *   launch(game)
   */
  window.launchGame = launchGame;
  window.launch = launchGame;

  window.VoidForge = {
    games,
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
  loadGames();

})();
