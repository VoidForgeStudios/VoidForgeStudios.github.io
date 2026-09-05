# BlockWorld v0.1

A small Minecraft-style voxel game made with **HTML, CSS, JavaScript, and Three.js**.

BlockWorld is a browser-based voxel game featuring a generated world, terrain, trees, first-person movement, block breaking/placing, and a hotbar.

## Features

* 🌍 Procedurally generated voxel world
* 🌳 Basic terrain and trees
* 🧱 Block breaking and placing
* 🎮 First-person controls
* 🏃 Sprinting
* 🦘 Jumping
* 🎒 Hotbar with block selection
* 🖱️ Mouse look and pointer lock
* 🌐 Runs directly in a modern web browser
* 📦 Easy to host as a static website

---

# Run Locally

Because the project uses ES modules, you should run it through a local web server instead of opening `index.html` directly with `file://`.

### Python

If Python is installed:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Node.js

You can also use a simple Node.js static server:

```bash
npx serve .
```

The terminal will provide a local URL to open in your browser.

### VS Code

If you use Visual Studio Code, install the **Live Server** extension.

Then:

1. Open the BlockWorld folder.
2. Right-click `index.html`.
3. Select **Open with Live Server**.
4. The game will open in your browser.

---

# Hosting Options

BlockWorld is a static website, so it can be hosted on many services without a backend.

## 1. GitHub Pages

GitHub Pages is one of the easiest free options.

1. Create a GitHub repository.
2. Upload all BlockWorld files.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select:

   * **Source:** Deploy from a branch
   * **Branch:** `main`
   * **Folder:** `/ (root)`
5. Click **Save**.
6. Wait for GitHub to deploy the site.

Your game will be available at a URL similar to:

```text
https://USERNAME.github.io/REPOSITORY/
```

---

## 2. Netlify

Netlify can host BlockWorld as a static site.

### Drag and Drop

1. Create a Netlify account.
2. Open the Netlify dashboard.
3. Create a new site.
4. Drag the BlockWorld project folder into the deployment area.
5. Netlify will automatically publish it.

### GitHub Deployment

You can also connect your GitHub repository to Netlify.

Netlify can automatically redeploy the game whenever you push new changes.

No build command is required for the basic BlockWorld project.

---

## 3. Vercel

Vercel works well for static HTML/CSS/JavaScript projects.

1. Create a Vercel account.
2. Import your GitHub repository.
3. Select the BlockWorld repository.
4. Leave the build settings at their defaults if no build step is required.
5. Deploy the project.

Vercel will provide a public URL for your game.

---

## 4. Cloudflare Pages

Cloudflare Pages is another good option for static websites.

1. Create a Cloudflare account.
2. Open **Workers & Pages**.
3. Create a new Pages project.
4. Connect your GitHub repository.
5. Select the repository containing BlockWorld.
6. Deploy it.

For this project, you generally do not need a build command.

Your site will receive a Cloudflare Pages URL.

---

## 5. Render

Render can also host the project as a static site.

1. Create a Render account.
2. Create a **Static Site**.
3. Connect your GitHub repository.
4. Select the BlockWorld repository.
5. Configure the project.
6. Deploy.

Since BlockWorld is a static project, there is no server-side code required.

---

## 6. Firebase Hosting

Firebase Hosting can be used if you want to host the game through Google's Firebase platform.

Install the Firebase CLI:

```bash
npm install -g firebase-tools
```

Log in:

```bash
firebase login
```

Initialize hosting:

```bash
firebase init hosting
```

Select the BlockWorld directory as your public directory.

Then deploy:

```bash
firebase deploy
```

Firebase will provide a public hosting URL.

---

## 7. Surge

For a very simple command-line deployment, you can use Surge.

Install Surge:

```bash
npm install --global surge
```

Then run it inside your BlockWorld directory:

```bash
surge
```

Follow the prompts to create your deployment.

---

## 8. Static Web Hosting / Any Web Server

BlockWorld does not require a special server.

It can be hosted on almost any web server capable of serving:

* `.html`
* `.css`
* `.js`
* textures/assets
* other static files

For example, you can use:

* Apache
* Nginx
* Caddy
* IIS
* shared hosting
* VPS hosting
* Docker
* static hosting providers

Make sure the server serves JavaScript modules correctly and that assets are available from the expected paths.

---

# Docker

You can also run BlockWorld with Docker.

Example using Nginx:

```dockerfile
FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80
```

Build the image:

```bash
docker build -t blockworld .
```

Run it:

```bash
docker run -p 8080:80 blockworld
```

Then open:

```text
http://localhost:8080
```

---

# Controls

| Key / Input | Action              |
| ----------- | ------------------- |
| `W`         | Move forward        |
| `A`         | Move left           |
| `S`         | Move backward       |
| `D`         | Move right          |
| `Shift`     | Sprint              |
| `Space`     | Jump                |
| Mouse       | Look around         |
| Left Click  | Break block         |
| Right Click | Place block         |
| `1` - `4`   | Select hotbar block |
| `Esc`       | Unlock mouse        |

---

# Browser Requirements

BlockWorld requires a modern browser with support for:

* JavaScript ES modules
* WebGL
* Pointer Lock API

Recommended browsers include recent versions of:

* Google Chrome
* Mozilla Firefox
* Microsoft Edge
* Safari

---

# Project Structure

A typical BlockWorld project may look like:

```text
BlockWorld/
├── index.html
├── style.css
├── main.js
├── README.md
└── assets/
    └── ...
```

Your exact structure may differ depending on the version of the project.

---

# Important Hosting Notes

### Use HTTPS

When deploying publicly, use an HTTPS-enabled host such as GitHub Pages, Netlify, Vercel, Cloudflare Pages, or Firebase Hosting.

### Do not open with `file://`

ES modules and browser security restrictions can cause problems when opening the game directly:

```text
file:///.../index.html
```

Use a web server instead.

### Keep file paths correct

When deploying to GitHub Pages or another static host, make sure JavaScript, CSS, textures, and other assets use paths that work from the deployed site.

---

# Version

**BlockWorld v0.1**

v0.1 is intentionally a prototype. It includes a generated voxel world, basic terrain and trees, first-person movement, block breaking/placing, and a hotbar.

More features may be added in future versions.
