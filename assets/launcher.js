(() => {
  "use strict";

  /* =========================================================
     DOM HELPERS
  ========================================================= */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  function createElement(tagName, className = "", text = null) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text !== null && text !== undefined) {
      element.textContent = String(text);
    }

    return element;
  }

  function appendChildren(parent, ...children) {
    children.forEach((child) => {
      if (child) {
        parent.appendChild(child);
      }
    });

    return parent;
  }

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
      toast = createElement("div", "vf-toast");
      toast.id = "vfToast";
      document.body.appendChild(toast);
    }

    toast.textContent = String(message ?? "");
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
    if (!entry) {
      return "";
    }

    let value = String(entry).trim();

    value = value
      .replace(/^\.\/+/, "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    if (!value) {
      return "";
    }

    if (
      value.includes("\\") ||
      value.includes("..") ||
      value.includes(":") ||
      value.startsWith("//")
    ) {
      return "";
    }

    return value;
  }

  function gameUrl(game) {
    const folder = normalizeFolder(game?.entry);

    if (!folder) {
      return "";
    }

    return `./${folder}/index.html`;
  }

  function setText(element, value) {
    if (!element) {
      return;
    }

    element.textContent =
      value === undefined || value === null
        ? ""
        : String(value);
  }

  function showLoader(show) {
    if (!gameLoader) {
      return;
    }

    gameLoader.hidden = !show;
  }

  function showError(message) {
    if (!gameError) {
      return;
    }

    gameError.hidden = false;

    const messageElement =
      $("#gameErrorMessage", gameError) ||
      $(".game-error-message", gameError) ||
      $("p", gameError);

    if (messageElement) {
      messageElement.textContent = String(message ?? "");
      return;
    }

    gameError.textContent = String(message ?? "");
  }

  function hideError() {
    if (!gameError) {
      return;
    }

    gameError.hidden = true;
  }

  /* =========================================================
     SAFE URL HELPERS
  ========================================================= */

  function getSafeImageUrl(value) {
    if (!value) {
      return "";
    }

    try {
      const url = new URL(
        String(value),
        document.baseURI
      );

      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  /* =========================================================
     GAME REGISTRY
  ========================================================= */

  function validateGames(data) {
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.games)
        ? data.games
        : null;

    if (!list) {
      throw new Error(
        "games.json must contain an array of games."
      );
    }

    return list.filter((game) => {
      return (
        game &&
        typeof game === "object" &&
        game.id !== undefined &&
        game.id !== null &&
        String(game.id).trim() !== "" &&
        game.entry !== undefined &&
        game.entry !== null &&
        normalizeFolder(game.entry) !== ""
      );
    });
  }

  function getRegistryPath() {
    const embedded = $("#embeddedGameRegistry");

    if (!embedded) {
      return "./games.json";
    }

    try {
      const parsed = JSON.parse(
        embedded.textContent.trim()
      );

      if (
        typeof parsed === "string" &&
        parsed.trim()
      ) {
        return sanitizeRegistryPath(parsed);
      }

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        typeof parsed.source === "string" &&
        parsed.source.trim()
      ) {
        return sanitizeRegistryPath(parsed.source);
      }
    } catch {
      // Fall back to default registry.
    }

    return "./games.json";
  }

  function sanitizeRegistryPath(value) {
    const path = String(value).trim();

    if (
      !path ||
      path.includes("\\") ||
      path.includes("..") ||
      path.includes(":") ||
      path.startsWith("//")
    ) {
      return "./games.json";
    }

    return path.startsWith("./")
      ? path
      : `./${path.replace(/^\/+/, "")}`;
  }

  function getEmbeddedGames() {
    const embedded = $("#embeddedGameRegistry");

    if (!embedded) {
      return null;
    }

    try {
      const parsed = JSON.parse(
        embedded.textContent.trim()
      );

      return Array.isArray(parsed)
        ? validateGames(parsed)
        : null;
    } catch {
      return null;
    }
  }

  async function loadGames() {
    try {
      const registryPath = getRegistryPath();

      const response = await fetch(registryPath, {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(
          `Unable to load ${registryPath} (${response.status})`
        );
      }

      const data = await response.json();

      games = validateGames(data);

      console.log(
        `[VoidForge] Loaded ${games.length} game(s) from ${registryPath}`
      );

      renderGames();

      return games;
    } catch (error) {
      console.error(
        "[VoidForge] Failed to load the game registry:",
        error
      );

      const fallbackGames = getEmbeddedGames();

      if (
        fallbackGames &&
        fallbackGames.length
      ) {
        games = fallbackGames;

        console.warn(
          "[VoidForge] Using embedded game registry fallback."
        );

        renderGames();

        showToast(
          "Using the embedded game registry because the game registry could not be loaded."
        );

        return games;
      }

      games = [];

      renderGames();

      showToast(
        "Unable to load the game library."
      );

      return [];
    }
  }

  /* =========================================================
     GAME CARD CREATION
     
     CSS / DOM STRUCTURE:

     article.game-card
       ├── div.game-card-image
       └── div.game-card-content
           ├── div.game-card-header
           │   ├── title/subtitle
           │   └── span.game-status
           ├── p.game-card-description
           ├── div.game-tags
           └── div.game-card-footer
               ├── span.game-platform
               └── button.play-game
  ========================================================= */

  function createGameCard(game) {
    const title =
      game.name ||
      game.title ||
      game.id ||
      "Game";

    const subtitle =
      game.subtitle ||
      "";

    const status =
      game.status ||
      "Available";

    const platform =
      game.platform ||
      "Browser";

    /*
     * FIX:
     * The outer card must use .game-card because
     * that is what the stylesheet targets.
     */
    const card = createElement(
      "article",
      "game-card"
    );

    card.dataset.gameId = String(game.id);

    /* -------------------------------------------------------
       IMAGE
    ------------------------------------------------------- */

    /*
     * FIX:
     * .game-art -> .game-card-image
     */
    const imageWrapper = createElement(
      "div",
      "game-card-image"
    );

    const imageSource = getSafeImageUrl(
      game.image ||
      game.thumbnail ||
      game.cover
    );

    if (imageSource) {
      const image = document.createElement("img");

      image.src = imageSource;
      image.alt = String(title);
      image.loading = "lazy";

      image.addEventListener(
        "error",
        () => {
          image.remove();

          imageWrapper.classList.add(
            "game-card-placeholder"
          );

          if (!imageWrapper.firstElementChild) {
            imageWrapper.appendChild(
              createElement(
                "span",
                "",
                String(title)
                  .charAt(0)
                  .toUpperCase()
              )
            );
          }
        },
        { once: true }
      );

      imageWrapper.appendChild(image);
    } else {
      imageWrapper.classList.add(
        "game-card-placeholder"
      );

      imageWrapper.appendChild(
        createElement(
          "span",
          "",
          String(title)
            .charAt(0)
            .toUpperCase()
        )
      );
    }

    /* -------------------------------------------------------
       CONTENT
    ------------------------------------------------------- */

    const content = createElement(
      "div",
      "game-card-content"
    );

    /*
     * FIX:
     * This was incorrectly "game-card".
     * It must be "game-card-header".
     */
    const header = createElement(
      "div",
      "game-card-header"
    );

    const headingGroup = createElement(
      "div"
    );

    const titleElement = createElement(
      "h3",
      "game-card-title",
      title
    );

    headingGroup.appendChild(
      titleElement
    );

    if (subtitle) {
      headingGroup.appendChild(
        createElement(
          "p",
          "game-card-subtitle",
          subtitle
        )
      );
    }

    header.appendChild(
      headingGroup
    );

    header.appendChild(
      createElement(
        "span",
        "game-status",
        status
      )
    );

    content.appendChild(
      header
    );

    /* -------------------------------------------------------
       DESCRIPTION
    ------------------------------------------------------- */

    if (game.description) {
      content.appendChild(
        createElement(
          "p",
          "game-card-description",
          game.description
        )
      );
    }

    /* -------------------------------------------------------
       TAGS
    ------------------------------------------------------- */

    const tags = Array.isArray(game.tags)
      ? game.tags
      : [];

    if (tags.length) {
      const tagContainer = createElement(
        "div",
        "game-tags"
      );

      tags.forEach((tag) => {
        if (
          tag === undefined ||
          tag === null
        ) {
          return;
        }

        tagContainer.appendChild(
          createElement(
            "span",
            "game-tag",
            tag
          )
        );
      });

      content.appendChild(
        tagContainer
      );
    }

    /* -------------------------------------------------------
       FOOTER
    ------------------------------------------------------- */

    const footer = createElement(
      "div",
      "game-card-footer"
    );

    footer.appendChild(
      createElement(
        "span",
        "game-platform",
        platform
      )
    );

    const playButton = createElement(
      "button",
      "play-game",
      "Play now"
    );

    playButton.type = "button";

    playButton.dataset.gameId =
      String(game.id);

    playButton.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();

        launchGame(game.id);
      }
    );

    footer.appendChild(
      playButton
    );

    content.appendChild(
      footer
    );

    /* -------------------------------------------------------
       FINAL CARD
    ------------------------------------------------------- */

    card.appendChild(
      imageWrapper
    );

    card.appendChild(
      content
    );

    /*
     * Double-click launches the game.
     */
    card.addEventListener(
      "dblclick",
      () => {
        launchGame(game.id);
      }
    );

    return card;
  }

  /* =========================================================
     EMPTY STATE
  ========================================================= */

  function createEmptyState(
    title,
    message
  ) {
    const emptyState = createElement(
      "div",
      "empty-state"
    );

    emptyState.appendChild(
      createElement(
        "h3",
        "",
        title
      )
    );

    emptyState.appendChild(
      createElement(
        "p",
        "",
        message
      )
    );

    return emptyState;
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

    const uniqueContainers = [
      ...new Set(containers)
    ];

    uniqueContainers.forEach(
      (container) => {
        renderGameList(container);
      }
    );
  }

  function renderGameList(
    container,
    searchTerm = ""
  ) {
    if (!container) {
      return;
    }

    const query = String(
      searchTerm || ""
    )
      .trim()
      .toLowerCase();

    const filteredGames =
      games.filter((game) => {
        if (!query) {
          return true;
        }

        const searchable = [
          game.name,
          game.title,
          game.subtitle,
          game.description,
          game.category,
          game.platform,
          ...(Array.isArray(game.tags)
            ? game.tags
            : [])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(
          query
        );
      });

    container.replaceChildren();

    if (!filteredGames.length) {
      container.appendChild(
        createEmptyState(
          "No games found",
          query
            ? "Try a different search."
            : "No games are currently available."
        )
      );

      return;
    }

    const fragment =
      document.createDocumentFragment();

    filteredGames.forEach(
      (game) => {
        fragment.appendChild(
          createGameCard(game)
        );
      }
    );

    container.appendChild(
      fragment
    );
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
        (item) =>
          String(item.id) ===
          String(gameOrId)
      );
    }

    if (!game) {
      showToast(
        "Game not found."
      );

      return;
    }

    const url = gameUrl(game);

    if (!url) {
      showToast(
        "This game does not have a valid entry path."
      );

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
      game.status ||
        "Available"
    );

    if (gameInfo) {
      const infoParts = [];

      if (game.subtitle) {
        infoParts.push(
          String(game.subtitle)
        );
      }

      if (game.version) {
        infoParts.push(
          `v${String(game.version)}`
        );
      }

      if (game.platform) {
        infoParts.push(
          String(game.platform)
        );
      }

      gameInfo.textContent =
        infoParts.join(" • ");
    }

    hideError();
    showLoader(true);

    if (gameView) {
      gameView.hidden = false;

      gameView.classList.add(
        "active"
      );
    }

    document.body.classList.add(
      "game-open"
    );

    if (gameFrame) {
      if (
        gameFrame.getAttribute("src") ===
        url
      ) {
        gameFrame.src =
          "about:blank";

        requestAnimationFrame(() => {
          if (
            currentGame === game &&
            gameFrame
          ) {
            gameFrame.src = url;
          }
        });
      } else {
        gameFrame.src = url;
      }
    }

    window.dispatchEvent(
      new CustomEvent(
        "voidforge:game-launch",
        {
          detail: game
        }
      )
    );
  }

  /* =========================================================
     CLOSE GAME
  ========================================================= */

  function closeGame() {
    currentGame = null;

    if (gameFrame) {
      gameFrame.src =
        "about:blank";
    }

    if (gameView) {
      gameView.classList.remove(
        "active"
      );

      gameView.hidden = true;
    }

    document.body.classList.remove(
      "game-open"
    );

    showLoader(false);
    hideError();

    window.dispatchEvent(
      new CustomEvent(
        "voidforge:game-close"
      )
    );
  }

  /* =========================================================
     RELOAD GAME
  ========================================================= */

  function reloadGame() {
    if (
      !gameFrame ||
      !currentGame
    ) {
      return;
    }

    const url = gameUrl(
      currentGame
    );

    if (!url) {
      showToast(
        "Unable to reload this game."
      );

      return;
    }

    hideError();
    showLoader(true);

    gameFrame.src =
      "about:blank";

    requestAnimationFrame(() => {
      if (currentGame) {
        gameFrame.src = url;
      }
    });
  }

  /* =========================================================
     GAME WINDOW EVENTS
  ========================================================= */

  function setupGameEvents() {
    if (gameFrame) {
      gameFrame.addEventListener(
        "load",
        () => {
          if (
            gameFrame.src !==
              "about:blank" &&
            currentGame
          ) {
            showLoader(false);
            hideError();
          }
        }
      );

      gameFrame.addEventListener(
        "error",
        () => {
          showLoader(false);

          showError(
            "The game could not be loaded. Please check the game folder and try again."
          );
        }
      );
    }

    if (closeButton) {
      closeButton.addEventListener(
        "click",
        closeGame
      );
    }

    if (reloadButton) {
      reloadButton.addEventListener(
        "click",
        reloadGame
      );
    }

    if (fullscreenButton) {
      fullscreenButton.addEventListener(
        "click",
        async () => {
          if (!gameFrame) {
            return;
          }

          try {
            if (
              document.fullscreenElement
            ) {
              await document.exitFullscreen();
            } else {
              await gameFrame.requestFullscreen();
            }
          } catch (error) {
            console.error(
              "[VoidForge] Fullscreen error:",
              error
            );

            showToast(
              "Fullscreen is not available."
            );
          }
        }
      );
    }

    if (gameInfo) {
      gameInfo.addEventListener(
        "click",
        () => {
          if (!currentGame) {
            return;
          }

          const description =
            currentGame.description ||
            currentGame.subtitle ||
            "No additional information is available.";

          showToast(
            description,
            5000
          );
        }
      );
    }
  }

  /* =========================================================
     ESCAPE KEY
  ========================================================= */

  function setupKeyboardEvents() {
    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape"
        ) {
          if (
            document.fullscreenElement
          ) {
            document
              .exitFullscreen()
              .catch(() => {});

            return;
          }

          if (
            currentGame &&
            gameView &&
            !gameView.hidden
          ) {
            closeGame();
          }

          return;
        }

        if (
          event.key === "/" &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          const activeElement =
            document.activeElement;

          const isTyping =
            activeElement &&
            (
              activeElement.tagName ===
                "INPUT" ||
              activeElement.tagName ===
                "TEXTAREA" ||
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
      }
    );
  }

  /* =========================================================
     NAVIGATION
  ========================================================= */

  function setupNavigation() {
    const navItems = $$(
      "[data-view], [data-nav]"
    );

    navItems.forEach(
      (item) => {
        item.addEventListener(
          "click",
          () => {
            const view =
              item.dataset.view ||
              item.dataset.nav;

            if (!view) {
              return;
            }

            navItems.forEach(
              (nav) => {
                nav.classList.remove(
                  "active",
                  "is-active"
                );

                nav.setAttribute(
                  "aria-current",
                  "false"
                );
              }
            );

            item.classList.add(
              "active",
              "is-active"
            );

            item.setAttribute(
              "aria-current",
              "page"
            );

            renderView(view);
          }
        );
      }
    );
  }

  function createViewHeading(
    title,
    subtitle
  ) {
    const heading = createElement(
      "div",
      "view-heading"
    );

    const inner =
      createElement("div");

    inner.appendChild(
      createElement(
        "h1",
        "",
        title
      )
    );

    if (subtitle) {
      inner.appendChild(
        createElement(
          "p",
          "",
          subtitle
        )
      );
    }

    heading.appendChild(
      inner
    );

    return heading;
  }

  function createLauncherView(
    className = ""
  ) {
    return createElement(
      "section",
      `launcher-view${
        className
          ? ` ${className}`
          : ""
      }`
    );
  }

  function renderView(view) {
    const viewRoot =
      $("#viewRoot");

    if (!viewRoot) {
      return;
    }

    switch (
      String(view).toLowerCase()
    ) {
      case "library":
      case "home":
        renderLibraryView(
          viewRoot
        );
        break;

      case "discover":
        renderDiscoverView(
          viewRoot
        );
        break;

      case "updates":
        renderUpdatesView(
          viewRoot
        );
        break;

      case "about":
        renderAboutView(
          viewRoot
        );
        break;

      case "settings":
        renderSettingsView(
          viewRoot
        );
        break;

      default:
        renderLibraryView(
          viewRoot
        );
        break;
    }
  }

  /* =========================================================
     LIBRARY VIEW
  ========================================================= */

  function renderLibraryView(root) {
    const section =
      createLauncherView(
        "library-view"
      );

    section.appendChild(
      createViewHeading(
        "Library",
        "Your VoidForge games."
      )
    );

    const grid = createElement(
      "div",
      "games-grid"
    );

    grid.id = "gamesGrid";

    section.appendChild(
      grid
    );

    root.replaceChildren(
      section
    );

    renderGameList(grid);
  }

  /* =========================================================
     DISCOVER VIEW
  ========================================================= */

  function renderDiscoverView(root) {
    const section =
      createLauncherView(
        "discover-view"
      );

    section.appendChild(
      createViewHeading(
        "Discover",
        "Explore the games available in VoidForge."
      )
    );

    const grid = createElement(
      "div",
      "games-grid"
    );

    grid.id = "gamesGrid";

    section.appendChild(
      grid
    );

    root.replaceChildren(
      section
    );

    renderGameList(grid);
  }

  /* =========================================================
     UPDATES VIEW
  ========================================================= */

  function renderUpdatesView(root) {
    const section =
      createLauncherView();

    section.appendChild(
      createViewHeading(
        "Updates",
        "Latest VoidForge updates."
      )
    );

    section.appendChild(
      createEmptyState(
        "You're up to date",
        "No new launcher updates are available."
      )
    );

    root.replaceChildren(
      section
    );
  }

  /* =========================================================
     ABOUT VIEW
  ========================================================= */

  function renderAboutView(root) {
    const section =
      createLauncherView();

    section.appendChild(
      createViewHeading(
        "About VoidForge",
        "VoidForge Studios browser game launcher."
      )
    );

    const content =
      createElement(
        "div",
        "about-content"
      );

    content.appendChild(
      createElement(
        "p",
        "",
        "VoidForge is a browser-based game launcher built for VoidForge Studios."
      )
    );

    const registryParagraph =
      createElement("p");

    registryParagraph.appendChild(
      document.createTextNode(
        "Games are loaded dynamically from "
      )
    );

    registryParagraph.appendChild(
      createElement(
        "code",
        "",
        "/games.json"
      )
    );

    registryParagraph.appendChild(
      document.createTextNode(".")
    );

    content.appendChild(
      registryParagraph
    );

    section.appendChild(
      content
    );

    root.replaceChildren(
      section
    );
  }

  /* =========================================================
     SETTINGS VIEW
  ========================================================= */

  function renderSettingsView(root) {
    const section =
      createLauncherView();

    section.appendChild(
      createViewHeading(
        "Settings",
        "Launcher settings."
      )
    );

    const content =
      createElement(
        "div",
        "settings-content"
      );

    content.appendChild(
      createElement(
        "p",
        "",
        "Launcher settings will appear here."
      )
    );

    section.appendChild(
      content
    );

    root.replaceChildren(
      section
    );
  }

  /* =========================================================
     SEARCH
  ========================================================= */

  function setupSearch() {
    const searchInput =
      $("#searchInput") ||
      $("#gameSearch") ||
      $('input[type="search"]');

    if (!searchInput) {
      return;
    }

    searchInput.addEventListener(
      "input",
      () => {
        const value =
          searchInput.value;

        const grids = [
          $("#gamesGrid"),
          $("#gameGrid"),
          $("#libraryGrid"),
          $(".games-grid"),
          $(".game-grid")
        ].filter(Boolean);

        const uniqueGrids = [
          ...new Set(grids)
        ];

        uniqueGrids.forEach(
          (grid) => {
            renderGameList(
              grid,
              value
            );
          }
        );
      }
    );
  }

  /* =========================================================
     LAUNCHER FULLSCREEN
  ========================================================= */

  function setupLauncherFullscreen() {
    const buttons = $$(
      '[data-action="fullscreen"], #fullscreenButton, #launcherFullscreen, #fullscreenLauncher'
    );

    buttons.forEach(
      (button) => {
        button.addEventListener(
          "click",
          async () => {
            try {
              if (
                document.fullscreenElement
              ) {
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
          }
        );
      }
    );
  }

  /* =========================================================
     MOBILE MENU
  ========================================================= */

  function setupMobileMenu() {
    const menuButton =
      $("#mobileMenu") ||
      $("#mobileMenuButton") ||
      $("#menuButton") ||
      $('[data-action="menu"]');

    const sidebar =
      $("#sidebar") ||
      $(".sidebar");

    if (
      !menuButton ||
      !sidebar
    ) {
      return;
    }

    menuButton.setAttribute(
      "aria-expanded",
      document.body.classList.contains(
        "nav-open"
      )
        ? "true"
        : "false"
    );

    menuButton.addEventListener(
      "click",
      () => {
        const isOpen =
          document.body.classList.toggle(
            "nav-open"
          );

        menuButton.setAttribute(
          "aria-expanded",
          isOpen
            ? "true"
            : "false"
        );
      }
    );

    $$(
      "[data-view], [data-nav]",
      sidebar
    ).forEach(
      (item) => {
        item.addEventListener(
          "click",
          () => {
            document.body.classList.remove(
              "nav-open"
            );

            menuButton.setAttribute(
              "aria-expanded",
              "false"
            );
          }
        );
      }
    );
  }

  /* =========================================================
     CONNECTION STATUS
  ========================================================= */

  function setupConnectionStatus() {
    const updateConnectionStatus =
      () => {
        const statusElements =
          $$(
            "#connectionStatus, .connection-status, [data-connection-status]"
          );

        statusElements.forEach(
          (element) => {
            if (
              navigator.onLine
            ) {
              element.textContent =
                "Online";

              element.classList.remove(
                "offline"
              );

              element.classList.add(
                "online"
              );
            } else {
              element.textContent =
                "Offline";

              element.classList.remove(
                "online"
              );

              element.classList.add(
                "offline"
              );
            }
          }
        );
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
    if (
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    if (
      location.protocol !== "https:" &&
      location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1"
    ) {
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

  window.launchGame =
    launchGame;

  window.launch =
    launchGame;

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

    await loadGames();

    await registerServiceWorker();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
