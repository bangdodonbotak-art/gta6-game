# SOLMAR — open-world crime game

Original 3D open-world crime game for the make.fun bounty `gta6-01`
("Make GTA 6"), built from scratch with three.js. No Rockstar assets,
no copied code — every model, texture, and sound is procedural.

## The game

You are Leo Marín, fresh out of the Solmar docks with empty pockets.
A sun-soaked procedural coastal city (5×5 blocks, beach + ocean) to
roam on foot and by car:

- **Drive & walk** — stealable cars, traffic, pedestrians
- **Wanted level 0–5 stars** — police chases that escalate with heat
- **3 sequential missions** — Hot Wheels, Package Run, The Big Score
- **HUD + 2D minimap**, procedural WebAudio (no audio files),
  best take saved in localStorage

## Play it

Desktop browser, keyboard + mouse. Static files, no network requests.

```sh
# from this folder
python3 -m http.server 8000
# then open http://localhost:8000/game/
```

Controls: **WASD** move · **Shift** run · drag mouse: camera ·
**E** steal / exit car · **F** punch · **W/S** drive · **A/D** steer ·
**Space** handbrake · **Esc** pause · **M** mute · follow the yellow
marker for missions.

## Layout

- `game/index.html` — entry point
- `game/src/` — city, player, vehicles, police, missions, HUD, audio
- `game/vendor/three.module.min.js` — vendored three.js (offline)
- `main.ts` — the house driver (kit entrypoint)
- `shots.json` + `serve.ts` — kit screenshot tooling

The 4 gameplay screenshots from the entry live in the submitted bundle,
not in this mirror (binary files).

## Status

Submitted to make.fun on 21 Nov 2026 as a source bundle; dev phase
graded (stage `scored`, all checks pass). Score/rank are withheld until
after entries close (24 Nov 2026, 22:00 WIB).

## License

MIT — see `LICENSE`.
