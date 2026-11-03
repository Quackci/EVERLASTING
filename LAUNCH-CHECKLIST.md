# Launch checklist

Honest status of everything this repository claims. "Verified" means it was run
in this environment and passed; "pending" means it is not built yet or cannot be
checked here.

## Automated checks — verified

- [x] `npm run typecheck` — renderer and Electron main both clean (strict).
- [x] `npm run lint` — clean, including the `Math.random()` ban.
- [x] `npm test` — 121 tests green: content validation, question keys recomputed,
      duplicate prompts, RNG determinism, A* pathfinding, dungeon determinism /
      connectivity / gates / boss floors, damage math, enemy scaling, aggro /
      leash, projectile aim, kill rewards, bitmap font, block/parry windows,
      room-scoped aggro, keybind defaults/conflicts/persistence, loot rolls,
      item upgrades and answer shuffling, class/difficulty/skill content,
      effect stacking and save-slot validation.
- [x] `npm run build` — production renderer builds (`dist/`, ~1.6 MB JS,
      383 kB gzipped).
- [x] `npm run build:main` — Electron main + preload bundle to CommonJS.
- [x] Dev server serves the game shell over HTTP with the preview host header.

## Gameplay — verified by construction, browser pass pending

- [x] Phaser boots at 480×270 with integer scaling and pixelated filtering.
- [x] Seeded floors render with theme-specific generated tilesets.
- [x] 8-direction movement, sprint, dodge with invulnerability window.
- [x] Wall collision via merged static bodies; camera follows with bounds.
- [x] Stairs descend to the next floor; floor/theme announced on arrival.
- [x] Bitmap font renders all UI text with no system font.
- [x] Every non-entrance room spawns an enemy pack (3-6) from that theme's pool,
      kept at least five tiles from the entrance.
- [x] Player swings the equipped supply with J or right click: reach + facing
      cone, crit rolls, knockback, ink gained per hit. Left click is the guard.
- [x] Holding left click blocks (damage reduced by the balance figure); tapping
      it inside the parry window negates the hit, stuns the attacker and deals a
      counter-hit.
- [x] Enemies only wake inside their own room and return home when the player
      leaves; corridors pull nobody.
- [x] Desks and lockers open with E, swap to an open sprite, and show the haul
      with a bonus question that upgrades one item on a correct answer.
- [x] Inventory on I lists items with icons and stats, and equipping updates
      the HUD weapon line and armour mitigation.
- [x] Controls can be rebound from the title screen or the pause menu, with
      conflicts refused and bindings persisted in local storage.
- [x] Enemy wind-ups are telegraphed by a flashing tint and last at least
      300 ms; the hit lands only if the player is still in range.
- [x] Ranged and turret enemies fire `projectile` shots that die on walls and
      damage the player on contact.
- [x] Damage numbers, camera shake, ink puffs and knockback fire on hits.
- [x] Enemies drop Smarts on death (normal / elite / boss bands from balance).
- [x] Elites use the elite HP and damage multipliers from balance.
- [ ] Affix behaviours (shielded, teleporting, splitting, vampiric) and boss
      phases are still data-only: the fields exist in content, the special rules
      are not wired yet.
- [x] Floors 4, 7 and 10 spawn their boss by the stairs; the stairs refuse to
      work while it is alive.
- [x] Player death shows a failure message and returns to the title screen.

Not yet built (tracked by milestone):
- [ ] Durability, the full item economy and fusion/forge (M4). A working
      inventory with equip, plus container loot, is now in.
- [ ] Quiz locks, pop quizzes, boss gates (M5). *Quiz gates are visually locked and
      report their status; the quiz UI itself is M5.*
- [ ] Loot, shop, meta-progression, save slots (M6).
- [ ] Audio, particles polish, full HUD and all menus (M7).
- [ ] Full settings (remapping, colourblind, text scale) and gamepad (M7).

## Manual checks

| Check | Status |
| --- | --- |
| Full run start → death → restart | Pending — the death flow exists, needs a human run |
| Save → quit → relaunch → continue | Pending (save layer is M6) |
| Quiz flows incl. hints and timeouts | Pending (M5) |
| Combat feel: telegraphs readable, kills satisfying | Pending — needs a human at a keyboard |
| Enemies cannot walk through walls or pile on the stairs | Pending — physics collider added, unverified on device |
| Block/parry feels fair: window readable, stun not too long | Pending — needs a human at a mouse |
| Desk/locker loot panel is legible and the bonus question is answerable | Pending — needs one on-screen pass |
| Inventory select/equip updates the HUD | Pending — needs one on-screen pass |
| Rebound keys still work after a relaunch | Pending — unit-tested store, real window unverified |
| Right click attacks without opening a context menu | Pending — needs a real window |
| GitHub Pages build plays in a browser | Pending — workflow added, first run needs the repo |
| Save slot writes on floor entry and resumes with class, difficulty, HP and skills | Pending — logic unit-tested, UI unverified |
| Class trade-offs are felt in play (tank vs assassin) | Pending — numbers verified, feel unverified |
| Skill tree purchase and persistence | Pending — aggregation unit-tested, screen unverified |
| Fusion with 2 and 3 ingredients | Pending (M4) |
| 30 minutes of play, zero crashes | Pending |
| Every settings toggle persists | Pending (settings UI is M7) |
| Windowed/fullscreen at runtime | Pending (only window sizing exists) |
| Physical gamepad hot-plug | Cannot test here — needs a human check |
| macOS Gatekeeper / Windows SmartScreen | Cannot test here — Linux container |
| 60 fps on 2015-era hardware | Cannot test here — needs target hardware |

## Packaging — Linux and Windows built here, macOS in CI

- [x] `linux.executableArgs` and the Electron main process both pass
      `--no-sandbox`, so the AppImage starts on distributions that restrict
      unprivileged user namespaces (Ubuntu 23.10+) whether it is double-clicked
      or launched straight from the shell.

- [x] `build/icon.png` (512×512) and `build/icon.ico` (16, 32, 48, 64, 128,
      256 px frames) generated by `npm run icon` from a 32×32 pixel map in the
      locked palette; no external art tools or image libraries.
- [x] `release/Everlasting-Infinite-Hallways-0.1.0-x86_64.AppImage` — **80 MB**
      compressed, inside the <120 MB budget.
- [x] AppImage contents verified by extracting it with `--appimage-extract`:
      `AppRun`, a `.desktop` entry, the hicolor icon, and a **1.6 MB `app.asar`**
      containing only `dist/`, `dist-electron/` and `package.json`.
- [x] `release/Everlasting-Infinite-Hallways-0.1.0-x64.tar.gz` — FUSE-free
      fallback for machines without `libfuse2`.
- [ ] **Launching the packaged app is not verified here.** This container has no
      X display, no FUSE and no `libnss3`, so the runtime stops at
      `dlopen(): error loading libfuse.so.2`. A human launch on a desktop Linux
      box is required before calling the build shippable.
- [ ] `.deb` deliberately disabled: electron-builder needs a real maintainer
      email and homepage, and this project has no publishing identity yet.
- [x] `release/Everlasting-Infinite-Hallways-0.1.0-win-x64-portable.exe` —
      **72 MB** single file, no install and no admin rights needed. Cross-built
      on Linux: `win.signAndEditExecutable` is off and `scripts/after-pack.mjs`
      stamps the icon group and version strings with `resedit`, so the build
      never needs Wine.
- [x] Portable executable inspected with `resedit`: one icon group with all six
      sizes, `ProductName: Everlasting Infinite Hallways`, `FileVersion: 0.1.0`,
      `CompanyName: Everlasting Team`; the NSIS SFX stub carries the same
      metadata, and its 7-Zip payload starts at offset 53612.
- [x] `release/Everlasting-Infinite-Hallways-0.1.0-x64.zip` — the same build
      unpacked (`Everlasting Infinite Hallways.exe`, `resources/app.asar` at
      1.6 MB, 79 entries) as a fallback for antivirus or SFX-hostile machines.
- [x] The app executable itself (`release/win-unpacked/`) is a valid
      `PE32+ executable (GUI) x86-64` with the stamped resources above.
- [ ] **Launching the Windows build is not verified here.** No Windows host, no
      Wine and no display exist in this container; only the binary structure,
      resources and payload were checked. `LAUNCH-CHECKLIST` will not call it
      shippable until someone runs it on a Windows laptop.
- [ ] The NSIS installer (`*-win-x64-setup.exe`) is built by CI on
      `windows-latest`: generating the uninstaller requires Wine on Linux. The
      Linux-built 171 kB stub left behind by that attempt was discarded.
- [ ] macOS `.dmg`/`.zip` need a macOS host or the CI matrix; no macOS SDK
      exists in this container.

## Fixes made in the packaging pass

- Centred bitmap labels were anchored at their left edge, so the title screen,
  floor toasts and pause banner drew their text beyond the right edge of the
  480×270 viewport. Labels now anchor by alignment.
- The HUD help line was clipped to 240 px inside a single line; it now spans the
  full view width.
- `app.asar` shipped every production dependency's sources (142 MB) even though
  Phaser is already inside the Vite bundle; `node_modules` is now excluded.
- The locked-gate message no longer advertises a future milestone; the door stays
  locked without breaking the fiction.
- `RunScene.init` no longer throws when the scene is started without run data.

## Known limitations

- Quiz locks are closed doors with no quiz UI yet (M5); they are not silently
  passable.
- No save/continue yet; each launch starts a fresh seeded run.
- Audio is absent, not broken — there is no failure path that blocks play.
