# VoidForge Studios Web Launcher

A static, GitHub Pages-compatible web launcher for the browser games bundled in this repository.

## Included game

- **Minecraft** — the bundled Minecraft-style BlockWorld voxel prototype in [`minecraft/`](minecraft/), launched from `minecraft/index.html`.

## Development

Run a static server from the repository root (ES modules in BlockWorld do not work from `file://`):

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`. The launcher is deliberately relative-path based, so it also works when GitHub Pages serves it from a repository subpath.

## Adding a browser game

1. Deploy the game folder and its `index.html` entry point.
2. Add its metadata and its **folder name only** as `entry` in [`games.json`](games.json), for example: `"entry": "minecraft"`.
3. Do not add a registry entry until that folder's `index.html` exists. The launcher validates the folder name and resolves it to `minecraft/index.html` before launch.

A browser cannot scan a deployed directory listing on GitHub Pages, so `games.json` is the explicit deploy-time game registry. The launcher does not install executables or write files to a visitor's computer.

## PWA behavior

The service worker caches the small launcher shell only. Game files are network-first and are not blindly stored by the launcher, avoiding unexpected caching of larger game resources.
