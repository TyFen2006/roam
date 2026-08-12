# Roam 🌅

**Running scored on fun, not pace.** A fun-first running app that rewards exploration, connection, and joy instead of speed — it sits on top of Strava/WHOOP and turns your city into a fog-of-war map you run into the light.

Built with **Vite + React** as a PWA.

## Features so far
- **Fog map** — a real fog-of-war reveal engine; running clears fog and inks a glowing trail. Demo run + live GPS (beta).
- **Run Moods** — pick what a run is about (Together / Explore / Scenic / Chill); mood weights scoring.
- **Social** — friend profiles (runs, badges, stats) and WHOOP-style groups you can join, each with a fun-points leaderboard.
- **Sunrise app icon** — installable to your home screen.

## Develop
```
npm install
npm run dev
```
Then open http://localhost:5173

## Build
```
npm run build
```
Outputs a self-contained site to `dist/` (via `vite-plugin-singlefile`).

## Deploy
Connected to **Netlify**: pushes to `main` auto-deploy. Build command `npm run build`, publish dir `dist` (see `netlify.toml`).

## Roadmap
- Real **Mapbox** basemap + follow-cam for outdoor GPS runs
- **Supabase** backend + accounts (make friends & groups real)
- The **You** profile tab + patch gallery
