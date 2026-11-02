/** Minimal typed event bus so perks, UI and progression never import each other. */

export interface GameEvents {
  hit: { attackerId: string; targetId: string; amount: number; crit: boolean; damageType: string };
  enemyKilled: { enemyId: string; smarts: number; floor: number; kind: string };
  damaged: { amount: number; source: string; hpLeft: number };
  answerCorrect: { questionId: string; tier: number; subject: string; streak: number };
  answerWrong: { questionId: string; tier: number; subject: string; timedOut: boolean };
  smartsChanged: { total: number; delta: number };
  floorCleared: { floor: number };
  runEnded: { floor: number; cause: string; seed: number };
  chestOpened: { rarity: string; itemId: string };
  fused: { itemId: string; prototype: boolean };
  toast: { text: string; tone: 'good' | 'bad' | 'info' };
  shake: { intensity: number; durationMs: number };
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

export class EventBus {
  #handlers = new Map<keyof GameEvents, Set<(payload: never) => void>>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<K>): () => void {
    const set = this.#handlers.get(event) ?? new Set();
    set.add(handler as (payload: never) => void);
    this.#handlers.set(event, set);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<K>): void {
    this.#handlers.get(event)?.delete(handler as (payload: never) => void);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.#handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      (handler as Handler<K>)(payload);
    }
  }

  clear(): void {
    this.#handlers.clear();
  }
}

export const gameEvents = new EventBus();
