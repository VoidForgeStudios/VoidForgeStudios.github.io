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
    /*
     * If your HTML already renders the game cards,
     * this function does nothing.
     *
     * It also supports a container with id="gameGrid".
     */
    const grid = $("#gameGrid");

    if (!grid || !games.length) return;

    grid.innerHTML = "";

    games.forEach((game, index) => {
      const card = document.createElement("button");

      card.type = "button";
      card.className = "game-card";
      card.dataset.gameIndex = index;

      card.innerHTML = `
        <strong>${escapeHtml(game.name || `Game ${index + 1}`)}</strong>
        ${game.description
          ? `<span>${escapeHtml(game.description)}</span>`
          : ""}
      `;

      card.addEventListener("click", () => {
        launchGame(game);
      });

      grid.appendChild(card);
    });
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
  loadGames();

})();
