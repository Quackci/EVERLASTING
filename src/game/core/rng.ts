/**
 * Deterministic, seedable RNG. Gameplay code must never call Math.random()
 * (enforced by an ESLint rule). Each subsystem forks its own channel so that
 * adding a roll in one system cannot shift the results of another.
 */

export interface Rng {
  /** Seed this generator was created from. */
  readonly seed: number;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** Uniform integer in [min, max] inclusive. */
  range(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  /** Derive an independent stream; same parent state always yields the same child. */
  fork(label: string): Rng;
  /** Number of values drawn so far (useful for debugging runs). */
  readonly steps: number;
}

/** FNV-1a 32-bit string hash. */
export function hashString(input: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32 core: small, fast, good enough for a roguelike and fully deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class SeededRng implements Rng {
  readonly seed: number;
  #nextValue: () => number;
  #steps = 0;

  constructor(seed: number) {
    const normalized = seed >>> 0;
    this.seed = normalized;
    this.#nextValue = mulberry32(normalized);
  }

  get steps(): number {
    return this.#steps;
  }

  next(): number {
    this.#steps += 1;
    return this.#nextValue();
  }

  int(maxExclusive: number): number {
    if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) {
      return 0;
    }
    return Math.floor(this.next() * Math.floor(maxExclusive));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  range(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi < lo) {
      return lo;
    }
    return lo + this.int(hi - lo + 1);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Rng.pick called with an empty list');
    }
    const value = items[this.int(items.length)];
    if (value === undefined) {
      throw new Error('Rng.pick produced an undefined value');
    }
    return value;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.int(i + 1);
      const a = copy[i];
      const b = copy[j];
      if (a === undefined || b === undefined) {
        continue;
      }
      copy[i] = b;
      copy[j] = a;
    }
    return copy;
  }

  fork(label: string): Rng {
    return new SeededRng(hashString(`${this.seed}:${label}:${this.#steps}`));
  }
}

export function createRng(seed: number): Rng {
  return new SeededRng(seed);
}

export function createSeededRng(seedText: string): Rng {
  return new SeededRng(hashString(seedText));
}

/** Weighted pick. Weights must be finite and non-negative; zero-weight entries are skipped. */
export function weightedPick<T>(rng: Rng, entries: readonly { value: T; weight: number }[]): T {
  const usable = entries.filter((entry) => entry.weight > 0);
  if (usable.length === 0) {
    throw new Error('weightedPick: no entries with a positive weight');
  }
  const total = usable.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.next() * total;
  for (const entry of usable) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.value;
    }
  }
  const last = usable[usable.length - 1];
  if (last === undefined) {
    throw new Error('weightedPick: unreachable');
  }
  return last.value;
}

/** Generates a shareable numeric seed from a clock-free source (UI passes Date.now()). */
export function randomSeed(source: number): number {
  return (Math.imul(source ^ 0x9e3779b9, 2654435761) ^ (source >>> 7)) >>> 0;
}
