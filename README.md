# VoidForge Studios Web Launcher

A static, GitHub Pages-compatible web launcher for the browser games bundled in this repository.

## Included game

- **BlockWorld** — the Minecraft-style voxel prototype in [`minecraft/`](minecraft/), launched from `minecraft/index.html`.

## Development

Run a static server from the repository root (ES modules in BlockWorld do not work from `file://`):

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`. The launcher is deliberately relative-path based, so it also works when GitHub Pages serves it from a repository subpath.

## Adding a browser game

1. Deploy the game's files and its real HTML entry point.
2. Add its real metadata and relative `entry` path to [`games.json`](games.json).
3. Do not add a registry entry until that entry point exists. The launcher verifies it before launch.

A browser cannot scan a deployed directory listing on GitHub Pages, so `games.json` is the explicit deploy-time game registry. The launcher does not install executables or write files to a visitor's computer.

## PWA behavior

The service worker caches the small launcher shell only. Game files are network-first and are not blindly stored by the launcher, avoiding unexpected caching of larger game resources.
