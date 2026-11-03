# Decisions

Short judgement calls made while building, with one line of rationale each.

1. **Plain systems instead of ECS** — <200 entities; components would add
   indirection without a payoff this size.
2. **Code-generated art from a locked 32-colour palette** — guarantees visual
   consistency with no binary assets, no licence risk and no case-sensitivity bugs.
3. **Bitmap font generated in code** — §9.6 forbids relying on system fonts, and a
   generated 5×7 font is original and identical on every OS.
4. **Named RNG channels per subsystem** — keeps floors reproducible when unrelated
   systems gain new rolls.
5. **Room count capped after BSP** — a split can overshoot by one leaf; capping is
   simpler and safer than special-casing the last split.
6. **Quiz gates on corridor tiles on the spawn→stairs path** — guarantees a lock
   actually blocks progress instead of being decorative.
7. **Fusion "rough prototype" triggered by broken ingredients or an 18% roll** —
   satisfies "failure is not a tax" while keeping the outcome deterministic.
8. **`verify` field on numeric questions** — lets tests recompute the answer key
   instead of trusting hand-written explanations.
9. **Electron loads the built renderer unless `VITE_DEV_SERVER_URL` is set** —
   makes `npm run dev:electron` work with one command and no second process.
10. **Harps on readability over difficulty** — every enemy wind-up is validated to
    be ≥300 ms; the validator rejects anything snappier for normal enemies.
11. **Integer scaling via CSS size, not Phaser zoom** — avoids fractional camera
    scaling and keeps 480×270 exact.
12. **Physics collision from merged wall runs** — hundreds of bodies instead of
    thousands, so the 60 fps target holds on integrated graphics.
13. **`noUncheckedIndexedAccess` left off** — strict mode is on; this extra flag
    mostly produces noise in tight grid loops and is handled by explicit guards.
14. **Content validator throws at import** — a bad reference must fail loudly at
    boot, not surface as `undefined` three floors later.
15. **Quiz lock currently reports "quiz sigil is dark"** — quiz interaction is M5;
    the door is genuinely locked and clearly labelled rather than faked open.
16. **Bitmap labels anchor by alignment (left 0, centre 0.5, right 1)** — a
    label's x is its alignment edge; anchoring everything at the left put
    centred title/toast text past the right edge of the 480×270 viewport.
17. **`node_modules` excluded from the packaged app** — Phaser is already inlined
    in the Vite bundle, so shipping its sources only inflated `app.asar` from
    1.6 MB to 142 MB and slowed every build.
18. **No `.deb` target yet** — electron-builder requires a maintainer email and
    homepage, and inventing them for a project with no publishing identity is
    worse than shipping AppImage + tarball and adding the target later.
19. **App icon drawn as 32×32 pixel art in `scripts/generate-icon.mjs`** — matches
    the in-game art rules, needs no design tool, and keeps the build free of
    native image dependencies; the PNG encoder is ~40 lines of zlib calls.
20. **Enemy stats grow linearly per floor, not compounding** — 24% HP per floor
    is plenty at depth 10; compounding would turn normal enemies into bosses.
21. **Enemies are plain records in a scene array, not sprites with behaviours**
    — one update loop keeps AI ordering, telegraphs and knockback readable and
    avoids 60 tiny classes for a 6-enemy room.
22. **The swing arc hit-tests with a dot-product cone (0.2) plus reach** — cheap,
    deterministic and editable without a physics body per attack.
23. **Hit-stop is camera shake, not a global timescale change** — pausing the
    physics world mid-frame desynchronises timers and input; shake reads the same
    at 480×270 and cannot leave the run in a slowed state.
24. **The starter weapon is hard-wired to `pencil` until the inventory lands**
    — M3 needs a weapon to test combat, and the reference item already exists in
    content, so no placeholder stats were invented.
25. **Windows PE metadata is stamped by a pure-JS `afterPack` hook** —
    electron-builder's own resource edit shells out to Wine when the host is
    Linux. `resedit` rewrites the icon group and version strings in-process, so a
    Windows build can be produced on Linux with no Wine, no native addon and no
    extra toolchain.
26. **`win.signAndEditExecutable: false`** — switches the Wine-dependent step
    off entirely instead of letting it fail, so Linux and the Windows CI runner
    both end up using the same hook and therefore the same metadata.
27. **`build/icon.ico` is generated beside `icon.png`** — Windows wants an ICO
    with several sizes; the existing dependency-free PNG encoder emits 16-256 px
    PNG frames, so no artist-supplied icon file or conversion tool is needed.
28. **Windows ships a portable `.exe` and a zip; the installer comes from CI** —
    portable needs no admin rights and runs straight from a downloads folder,
    which is what "give me an exe" actually means in practice. NSIS uninstaller
    generation requires Wine on Linux, so `setup.exe` is only produced on
    `windows-latest`.
29. **Unsigned builds are explicit, not accidental** — the project has no code
    signing certificate, so signing is skipped (logged by the builder) and the
    README tells players about the SmartScreen *More info → Run anyway* path
    rather than pretending the warning will not appear.
30. **Facing and animation read the raw input axes, not the velocity** — the
    old code normalised the movement vector and then inferred direction from it,
    so diagonal input could pick the wrong walk cycle while the dodge impulse
    came from a stale facing. Input axes now drive facing, animation and dodges
    in the same frame, and the post-hit steering lockout is a short explicit
    knockback timer instead of a condition on the invulnerability clock.
31. **Left click guards, right click attacks, J is the keyboard attack** — each
    mouse button has one job, and the guard cannot be raised and swung at the same
    time. The parry window is measured from the left press, so holding is defence
    and tapping on impact is skill. Phaser's context-menu suppression is enabled
    so right click never opens the browser or Electron menu.
32. **Aggro is room-scoped** — an enemy wakes only when the player is inside its
    own room and within the alert radius, and goes home the moment the player
    leaves. Corridors belong to nobody, so walking past a door cannot pull the
    floor; room ids come from the generator, not from distance hacks.
33. **Desks and lockers replace abstract chests** — content already described a
    school, and the two silhouettes read differently at 16 px: a locker is tall
    steel with a glowing seam, a desk is furniture with a drawer. Rarity comes
    from the existing weight tables, so loot is not re-tuned for the new art.
34. **A correct bonus question upgrades one item, not the whole haul** — one
    upgrade keeps the choice meaningful and keeps the reward readable; the
    target is the most valuable item found so the player is never made to pick
    blind in a menu.
35. **Keybinds are stored as numeric key codes with a sanitiser** — the store is
    `localStorage`, which can be edited or corrupted, so loading runs every code
    through `sanitizeKeybinds`: junk becomes the default, duplicates are
    repaired, and a key already owned by another action is rejected rather than
    silently stolen.
36. **Saves live in local storage, not the save IPC** — Electron already has a
    file-backed save bridge, but using it would give the desktop build a
    different code path from the Pages build. `localStorage` exists in both, so
    one versioned, validated save module serves every target and the schema can
    be unit-tested with a stub.
37. **A save is written on floor entry, and death clears the slot** — writing on
    every hit would churn storage, and writing only on quit loses a run when the
    process is killed. Floor granularity loses at most one floor, which matches
    how the run is paced.
38. **Classes are content, not hard-coded branching** — stats and pros/cons live
    in `classes.json` so the validator can prove every starting weapon exists and
    every multiplier is positive, exactly like enemies and items.
39. **Skill nodes reuse `PerkEffects`** — a node is an effect block (plus a few
    flat stats), folded through the same aggregation as perks. That keeps one
    stacking rule, one place to change damage maths, and no parallel buff system.
40. **Difficulty multiplies enemy stats at spawn and loot at roll time** — the
    multipliers are passed into the existing pure functions rather than mutating
    content, so switching difficulty never rewrites the loaded data and the
    tests keep exercising the same curves.
41. **Rooms and kill streaks pay health back** — clearing a room that held
    enemies restores 10% of max HP, and every third kill restores 20%. Both live
    in `balance.json.recovery` and are applied by pure helpers in
    `systems/recovery.ts`, so the cadence is testable and one file retunes the
    curve. Percentages rather than flat numbers keep the payout fair for the Hall
    Monitor's 135 HP and the Class Cutter's 80. A room pays once per floor and
    only if it actually spawned an enemy, so walking empty rooms cannot be farmed.
