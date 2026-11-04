# Everlasting: Infinite Hallways

A top-down pixel-art school roguelike. Supplies are weapons, knowledge is power,
and the school rearranges itself every night. Offline, single-player, no accounts,
no ads, no telemetry.

> **Build status:** M1 (skeleton, Phaser boot, 8-direction movement, collision,
> integer scaling), M2 (seeded BSP floors, camera, generated tilesets) and M3
> (enemies, elites, bosses, melee combat, telegraphed attacks, damage and death)
> are implemented and verified. Packaged builds live in `release/`: Linux
> AppImage + tarball, and a Windows single-file portable `.exe` plus a zip of the
> same build. Quiz locks, fusion, loot and audio land in later milestones — see
> `LAUNCH-CHECKLIST.md` for exactly what is and is not verified.

## Quick Start

Prerequisite: **Node.js LTS (20+)**. Nothing else. No C++ toolchain, Python,
Xcode command-line tools, or native modules.

```bash
npm ci          # install dependencies from the lockfile
npm run dev     # browser playtest at http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, browser playtest with hot reload |
| `npm run dev:electron` | Build the renderer and main process, then launch the desktop app |
| `npm run build` | Production renderer build into `dist/` |
| `npm run build:main` | Bundle the Electron main process and preload into `dist-electron/` |
| `npm run typecheck` | Strict TypeScript check for renderer and Electron |
| `npm run lint` | ESLint, including the ban on `Math.random()` in gameplay |
| `npm test` | Vitest (pure logic, headless) |
| `npm run build:mac` | `.dmg` + `.zip` (universal) via electron-builder |
| `npm run build:win` | NSIS installer + portable `.exe` (installer needs Windows or Wine) |
| `npm run build:win:portable` | Portable `.exe` only — cross-builds from Linux without Wine |
| `npm run build:linux` | `.AppImage` + `.tar.gz` (no `.deb` until a maintainer identity exists) |
| `npm run icon` | Regenerate `build/icon.png` (32×32 pixel art, upscaled 16×) |

### Per-OS notes

- **Windows:** download
  `release/Everlasting-Infinite-Hallways-0.1.0-win-x64-portable.exe` and run it —
  no install, no admin rights, no prerequisites beyond 64-bit Windows 10/11.
  Alternatively unzip `release/Everlasting-Infinite-Hallways-0.1.0-x64.zip` and
  run `Everlasting Infinite Hallways.exe` from the extracted folder. Both are
  unsigned, so SmartScreen shows *Windows protected your PC*: choose *More info →
  Run anyway*. The NSIS installer (`*-win-x64-setup.exe`) is produced by CI on
  Windows, because NSIS needs Wine when built from Linux. For development,
  `npm ci` then `npm run dev`.
- **macOS:** `npm ci` then `npm run dev`. A locally built unsigned `.dmg` may be
  quarantined; `xattr -dr com.apple.quarantine "/Applications/Everlasting Infinite Hallways.app"`
  clears it. Builds are not notarised in this repository.
- **Linux:** `npm ci` then `npm run dev`. The packaged `.AppImage` needs FUSE 2
  (`sudo apt install libfuse2t64` on Ubuntu 24.04+); `chmod +x` it first. Without
  FUSE, unpack the `.tar.gz` and run the `everlasting-infinite-hallways` binary
  inside it. Both are unsigned; the bundled desktop entry already passes
  `--no-sandbox`, which the AppImage runtime needs on distributions that restrict
  unprivileged user namespaces.

## Controls

| Action | Default binding | Notes |
| --- | --- | --- |
| Move | WASD / arrow keys | The arrow keys always work alongside the bound keys |
| Sprint | Shift (tap) | Burst of speed with a short cooldown |
| Swing your supply | J or right click | Both fire the same attack and share one cooldown |
| Block / parry | Left mouse button (hold) | Tap on impact to parry: no damage, the attacker is stunned |
| Dodge roll | Space | Short burst of invulnerability |
| Open desk / locker / stairs | E | Glowing lockers and desks are within reach when prompted |
| Inventory | I | Equip weapons and armour, read item specials |
| Skill tree | K (from the pause menu) | Spend Smarts on your class's six nodes |
| Pause / menu | Escape | Resume, inventory and controls |

Every action except the arrow-key alternates is rebindable. Press **C** on the
title screen, or choose **C - CONTROLS & KEYBINDS** from the pause menu, then
click a row (or select it with W/S) and press the key you want. A key that is
already taken is refused with the name of the action holding it, so two actions
never fire together. Bindings persist in local storage between launches, and
**R** restores the defaults.

Health comes back from two places during a run: clearing a room that held
enemies restores 10% of your maximum HP, and every third kill restores 20%.
Both payouts are percentages, so the Hall Monitor's 135 HP bar and the Class
Cutter's 80 scale the same way, and both numbers live in
`src/game/content/balance.json`.

## Controls and keybinds

Every action on the controls screen is rebindable, and the two mouse buttons are
bind codes like any key: ENTER on a row, then press the key or click the button
you want. Backspace clears a bind, R restores the defaults, and conflicts are
refused rather than silently stealing a key. The controls screen is reachable
from the title and from the pause menu, and a rebind made mid-run is applied as
soon as you close it.

## Bosses, loot and the locker room

Floors 4, 7 and 10 end in a boss. A boss drops gear rolled at the stage's own
power level — the tier climbs with the floor, so the floor 10 principal hands you
the kind of weapon the last act expects. Your bag, equipped weapon and armor now
travel down the stairs with you instead of resetting to the class starter.

Killing a boss also opens a lit locker room in its chamber. Walk back to the
lockers and use them: pick a piece of gear, answer the question on the bench, and
a correct answer upgrades that item a tier. Three questions per boss, a wrong
answer burns one, and the room locks after your visit.

Enemies grow harder every floor — HP and damage climb steeply with depth, elites
become more common, and the numbers live in `enemyScaling` in
`src/game/content/balance.json`.

## Saves, students and difficulty

The game opens on **Choose a Locker**: three save slots. An empty slot starts a
new run, a filled one resumes exactly where that run reached — seed, floor,
class, difficulty, Smarts, HP and learned skills are all restored. **N** starts a
fresh run in the selected slot, **Del** erases it. A run is written to its slot
every time a floor is entered, so closing the game never loses more than one
floor; dying clears the slot.

Four students are playable, each with a real trade-off rather than a damage
number:

| Student | Role | Stands out at | Pays for it with |
| --- | --- | --- | --- |
| Field Tripper | Adventurer | Cheapest skill tree, no weaknesses | No standout strength |
| Arrow-Demic | Archer | Starts with a ranged supply, +12 reach, +6% crit | 15% less HP |
| Hall Monitor | Tank | +35% HP, 6 armour, stronger blocks | Slow, long dodge cooldown, no crits |
| Class Cutter | Assassin | +12% crit, fast feet, short dodge cooldown | 20% less HP and no armour |

Three difficulties are chosen once per run: **Pop Quiz** (softer enemies, more
Smarts), **Midterm** (the balanced default) and **Final Exam** (30% tougher
enemies, leaner loot).

## Skill trees

Smarts double as currency. Press **K** in the pause menu to open your class's
six-node tree, three tiers deep and branching from two tier-one roots. A node
costs Smarts (20–100), must have its prerequisite, and permanently changes the
run: max HP, armour, movement, Ink, damage, crit chance, reach or attack speed.
Purchased nodes are stored in the save slot, so a resumed run keeps them.

## Containers and bonus questions

Desks and hallway lockers are the loot containers. Lockers hum with a yellow
glow when they still hold something; desks wait quietly. Press **E** in range to
open one, read what you found, then optionally take a bonus question: a correct
answer upgrades the most valuable item in that haul by one tier (damage, speed,
crit chance and durability all rise). A wrong answer costs nothing but the
upgrade.

## Play in a browser (GitHub Pages)

The renderer is a plain Vite build, so the same game runs on the web. Push this
repository to GitHub, then open **Settings -> Pages** and set **Source** to
**GitHub Actions**. The `Publish playable build` workflow
(`.github/workflows/pages.yml`) typechecks, tests, builds and deploys on every
push to `main`, and the game appears at `https://<user>.github.io/<repo>/`.

Asset paths are relative (`base: './'` in `vite.config.ts`), so a project-page
subpath works with no extra configuration, and the browser build is the same
offline game as the desktop one.

## Rendering and scaling

The game renders internally at **480×270** and is scaled by whole numbers only
(`image-rendering: pixelated`), so pixels stay square at 720p, 1080p, 1440p and
4K, including Windows display scaling at 125% / 150%.

## Troubleshooting

- **Black screen:** open the browser console. A content validation failure throws
  a readable error listing every bad reference; the boot screen also prints it.
- **Port already in use:** `PORT=3002 npm run dev`.
- **No audio yet:** audio ships in the polish milestone; the game is silent but
  fully playable.
- **Sluggish on an old laptop:** the Canvas renderer is used automatically when
  WebGL is unavailable.

## Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — module layout, update model, determinism.
- [`DECISIONS.md`](DECISIONS.md) — one-line rationale for every judgement call.
- [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md) — verified vs. pending, per platform.
- [`CREDITS.md`](CREDITS.md) — art, font and content provenance.
