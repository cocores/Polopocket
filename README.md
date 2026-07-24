# Polopocket — Polaroid Cam

A retro instant-camera web app: live viewfinder, shutter with flash/flip, photos that "eject" and develop in phases like real instant film, and a drag-to-file Print Box drawer.

Falls back to a procedural demo mode when camera access isn't available (e.g. no HTTPS, no permission, or no camera).

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Note: `getUserMedia` (the live camera feed) requires a secure context (HTTPS or localhost). Everywhere else it gracefully falls back to demo mode.

## Testing on your phone (iPhone / Android)

A camera-enabled phone browser needs an HTTPS URL — `http://<lan-ip>:5173` won't get camera permission, only `localhost` or HTTPS do. This repo deploys to GitHub Pages automatically via `.github/workflows/deploy-pages.yml` on every push to `main` or `claude/code-build-setup-w5jmag`.

One-time setup (repo admin): in GitHub, go to **Settings → Pages → Build and deployment → Source**, and select **GitHub Actions**. After that, every push triggers a build+deploy, and the app is served at:

```
https://cocores.github.io/Polopocket/
```

Open that URL on your phone, allow camera access when prompted, and the live viewfinder works — including the flip button to switch between front/back cameras.
