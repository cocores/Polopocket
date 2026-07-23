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
