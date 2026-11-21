// SOLMAR — the entry program for the make.fun gta6-01 bounty.
//
// What it does, in plain terms: it takes this repository's game/ folder
// (the whole SOLMAR open-world game: three.js 3D city, driving, wanted
// system, missions, HUD — plain static files, no build step) and the
// screenshots/ folder (four real renders of the game), copies both into
// the output directory, and writes dossier.json there with buildDossier
// from the vendored make.fun library (vendor/makefun-game.ts).
//
// How to run it outside the grader:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader, MAKEFUN_OUTPUT_DIR is unset and /output is used.
//
// Only the Node 22 standard library is used (node:fs, node:path, node:url),
// and the program is plain erasable TypeScript — no installs, no network,
// no build step. The scorer's caps are passed through unchanged so a bad
// entry fails here first, in this repo, instead of at the gate.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The directory this file lives in — the repository root.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// The grader gives us /output; local runs use MAKEFUN_OUTPUT_DIR instead.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output tree: game/ first, then screenshots/ beside it.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

const shotsDir = join(repoRoot, 'screenshots');
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier is the judge's view of the entry: the game source (capped at
// 160 KiB of text), the screenshots, and the totals. The caps below mirror
// the gate's own limits — at most 4 screenshots of 256 KiB each, at most
// 993 files / 48 MiB under game/, paths under 1000 bytes — so anything the
// gate would refuse is refused here, deterministically, on both runs.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
