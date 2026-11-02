# Credits and provenance

## Code and content

Original work for this project, licensed CC-BY-4.0. All 150 quiz questions were
written for this game; numeric answer keys are recomputed in the test suite.
Supply names, flavour text, perks, recipes, enemies and room templates are
original.

## Art

No image files ship with the game. Every sprite, tile, icon, prop and particle is
drawn procedurally at runtime from the 32-colour palette in
`src/game/art/palette.ts`, and all text uses the original 5×7 bitmap font in
`src/game/art/font.ts`. There are no ripped, traced or trademarked assets.

## Audio

No audio ships yet. The planned SFX and three chiptune loops are synthesised with
WebAudio oscillators (no external files); that work is scheduled for the polish
milestone and will be credited here when it lands.

## Fonts

No external font files are used. The bitmap font is original to this project, so
no OFL notice is required.

## Dependencies

Phaser 3 (MIT), Vite (MIT), Electron (MIT), electron-builder (MIT),
TypeScript (Apache-2.0), Vitest (MIT), ESLint (MIT). See `package-lock.json` for
the full tree.
