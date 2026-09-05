# VoidForge Studios Web Launcher

A static, GitHub Pages-compatible launcher for the VoidForge Studios browser game.

## Included game

- **Minecraft / BlockWorld** — a self-contained browser voxel game in [`minecraft/`](minecraft/), launched by the root launcher at `minecraft/index.html`.

The launcher keeps a single Minecraft library entry, supports search and navigation views, and provides reload, fullscreen, game information, and exit controls while playing.

## Development

Run a static server from the repository root (Minecraft uses an ES module and does not work from `file://`):

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/` and select **Play now**. The launcher is deliberately relative-path based, so it also works when GitHub Pages serves it from a repository subpath.

## Minecraft controls

- Click **PLAY** to lock the mouse and start.
- WASD moves; Shift sprints; Space jumps; mouse looks around.
- Left click breaks a block; right click places the selected block.
- Keys 1–4 select the hotbar block; Esc unlocks the mouse.

## GitHub Pages deployment

1. Push this repository to GitHub.
2. In **Settings → Pages**, choose **Deploy from a branch**, then select the branch and repository root.
3. Open the deployed repository URL, such as `https://USERNAME.github.io/REPOSITORY/`.

All launcher, manifest, and service-worker paths are relative so project-site URLs work without configuration. [`games.json`](games.json) is the deployed game registry and contains only the `minecraft` entry; the same entry is embedded in `index.html` as a fallback for local `file://` viewing.

## PWA behavior

The service worker caches only the small launcher shell. Minecraft requests remain network-loaded and are not added to the launcher cache, avoiding stale game resources.
