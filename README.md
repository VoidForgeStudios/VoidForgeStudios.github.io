# VoidForge Studios Web Launcher

A static, GitHub Pages-compatible launcher for VoidForge Studios browser games.

## Adding a game

The launcher reads every available game from `games.json`. Add an object with a
unique `id` and an `entry` directory containing an `index.html` file; it will
automatically appear in Library and Discover and launch in the shared game
player. Game files are fetched normally by the service worker, so this works
for every registered game rather than applying special handling to Minecraft.

```json
{
  "id": "my-game",
  "name": "My Game",
  "entry": "my-game",
  "status": "Available"
}
```
