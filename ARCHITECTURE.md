# Architecture

## Stack

TypeScript (strict) · Phaser 3 (WebGL, Canvas fallback) · Vite · Electron +
electron-builder · Vitest. No native modules and no runtime network access.

## Layout

```
src/
  main/        Electron main process: window, save IPC, menus
  preload/     contextBridge only (contextIsolation on, nodeIntegration off)
  shared/      IPC contract shared by main and renderer
  game/
    core/      seeded RNG, typed event bus
    content/   typed JSON content + boot-time validation
    systems/   pure game logic (combat, fusion, quiz, loot, ...)
    world/     deterministic dungeon generation, A* pathfinding
    art/       palette, generated sprites, bitmap font
    scenes/    Boot, Title, Run
    main.ts    Phaser boot, integer scaling, fatal-error surface
test/          Vitest specs (Node, no DOM, no Phaser)
```

## Update model: plain systems, no ECS

I chose **plain objects + explicit systems** over a full ECS. The game has under
200 entities; a component-system would add indirection without buying anything.
The rule is simple and enforced by review:

- **Definitions** are immutable content (`ItemDef`, `EnemyDef`, …) parsed once.
- **Instances** are small plain objects created by the run state.
- **Systems** are functions that take state + inputs and return results; combat
  and fusion are pure so the balance harness and tests share the exact code.

Phaser scenes own presentation only. No gameplay balance number is written in a
scene: everything comes from `src/content/balance.json`.

## Determinism

All randomness flows through `core/rng.ts` (mulberry32 seeded by FNV-1a). Each
subsystem forks a named channel (`floor-3`, `combat`, `loot`) so adding a roll in
one system cannot shift another's results. `Math.random()` is banned by ESLint in
`src/`, so a seeded run reproduces exactly: same seed + same inputs = same floor,
same loot, same damage rolls. The seed is stored in the run state and shown on the
death screen.

Floor generation (`world/dungeon.ts`) is a pure function of `(seed, floor)`:

1. Recursively split the map with BSP, then carve one room per leaf.
2. Cap the room count to the 8–14 design range, then join rooms with one-tile
   L-corridors in x-order plus a few loops.
3. Assign roles: entrance, stairs (farthest room), workshop, optional study nook,
   boss arena on floors 4/7/10.
4. Place quiz gates on corridor tiles **on the critical path** so they actually
   gate progress rather than decorating a room.
5. Scatter chests, props from theme room templates, and enemy spawns.

`buildFloor` verifies every room is reachable and retries with a derived seed if
a pathological split ever sealed one off.

## Damage pipeline

`systems/combat.ts` aggregates perk effects declaratively (30+ perks share one
schema), then computes: base + flat → multipliers → crit → situational bonuses →
armor (with penetration) → resistance → minimum 1. Every step returns the
absorbed/resisted breakdown so the UI can explain a hit rather than just show a
number.

## Content validation

`content/index.ts` validates the entire bundle at import time. Unknown item/perk/
recipe/enemy/theme references, wrong choice counts, invalid answer indices,
duplicate prompts, impossible timers and under-volume collections all throw a
single readable error listing every issue. The same validator runs in CI.

Questions are data, and numeric ones carry an expected value (`verify`) that tests
recompute from the chosen answer, so a bad answer key fails the build.

## Rendering and assets

One locked 32-colour palette (`art/palette.ts`) feeds every generated texture:
tiles, player frames, enemy silhouettes, item icons, props, particles. Art is
drawn in code at 16×16 (12×12 icons) so there are no binary assets to get the case
or resolution wrong, and elites reuse archetypes with recoloured palettes.

Text uses an original 5×7 bitmap font (`art/font.ts`) rasterised onto cached
canvas textures — no system font is ever requested, so layout is identical on
every OS.

The whole floor is baked once into a single `RenderTexture`. Collision uses
horizontally merged static bodies, which keeps the physics step cheap regardless
of wall count.

## Saves

Electron main owns the filesystem: `app.getPath('userData')/saves/slot-N.json`,
with a `.bak` copy written before each replace and atomic temp-file renames. The
renderer only sees `window.everlasting.save.{read,write,list}` through the
preload bridge. Browser dev mode will fall back to `localStorage` (save layer
lands with the run-state milestone).
