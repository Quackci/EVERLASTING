/**
 * Sigil-locked doors.
 *
 * Floors are deterministic, so a gate's rune and the question behind it are
 * derived from the run seed, the floor and the gate index rather than from scene
 * state. The door itself is a real blocker: the only way through is to answer
 * the rune, and a wrong answer costs nothing, so a gate can never strand a run.
 *
 * Pure module (no Phaser) so the rune maths and the wording are testable.
 */
import { createRng, type Rng } from '../core/rng';

export interface SigilPattern {
  /** Radius of the outer chalk ring, in pixels. */
  radius: number;
  /** Number of radial spokes, 3-7. */
  spokes: number;
  /** Rotation of the spoke fan, in radians. */
  rotation: number;
  /** Number of dots punched around the ring, 0-6. */
  marks: number;
  /** Whether an inner triangle is part of the rune. */
  triangle: boolean;
}

/** The gate's own random channel, so one door never shifts another's question. */
export function sigilRng(seed: number, floor: number, gateIndex: number): Rng {
  return createRng(seed >>> 0).fork(`sigil-${floor}-${gateIndex}`);
}

/** The chalk rune a gate wears: stable per floor and gate, different per door. */
export function sigilPattern(seed: number, floor: number, gateIndex: number, radius = 20): SigilPattern {
  const rng = sigilRng(seed, floor, gateIndex);
  return {
    radius: Math.max(6, Math.round(radius)),
    spokes: rng.range(3, 7),
    rotation: rng.next() * Math.PI * 2,
    marks: rng.range(0, 6),
    triangle: rng.chance(0.55),
  };
}

/** The in-world prompt shown when the player is close enough to read a gate. */
export function sigilPrompt(open: boolean, interactKey: string): string {
  return open ? 'THE DOOR STANDS OPEN' : `${interactKey}  READ THE SIGIL`;
}

export function sigilHeadline(correct: boolean): string {
  return correct ? 'THE SIGIL BURNS - THE DOOR OPENS' : 'THE SIGIL STAYS DARK';
}

/** A wrong answer costs nothing, so the retry hint has to say so. */
export function sigilRetryHint(correct: boolean): string {
  return correct ? 'SPACE  STEP THROUGH' : 'SPACE  TRY ANOTHER ANSWER';
}
