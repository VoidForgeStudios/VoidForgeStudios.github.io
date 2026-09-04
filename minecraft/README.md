# BlockWorld v0.1

A small Minecraft-style voxel game made with HTML, CSS and JavaScript + Three.js.

## Run locally

Because the project uses ES modules, open it through a local web server rather than `file://`.

For example, with Python:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

1. Upload all files to a GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`.
5. Save and wait for the Pages deployment.

## Controls

- WASD — move
- Shift — sprint
- Space — jump
- Mouse — look
- Left click — break block
- Right click — place selected block
- 1–4 — select hotbar block
- Esc — unlock mouse

## Version

v0.1 is intentionally a prototype. It has a generated voxel world, basic terrain/trees, first-person movement, block breaking/placing and a hotbar.
