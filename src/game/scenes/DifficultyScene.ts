import Phaser from 'phaser';
import { BALANCE, CLASS_BY_ID, DIFFICULTIES } from '../content';
import { PixelLabel } from '../art/text';
import { paletteHex } from '../art/sprites';

const VIEW_W = BALANCE.world.viewWidth;
const VIEW_H = BALANCE.world.viewHeight;
const ROW_TOP = 78;
const ROW_HEIGHT = 42;

interface DifficultyData {
  slot?: number;
  seed?: number;
  classId?: string;
}

export class DifficultyScene extends Phaser.Scene {
  #index = 1;
  #slot = 1;
  #seed = 1;
  #classId = '';
  #gfx?: Phaser.GameObjects.Graphics;
  #labels: PixelLabel[] = [];
  #keyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super('Difficulty');
  }

  create(data: DifficultyData = {}): void {
    this.#slot = data.slot ?? 1;
    this.#seed = data.seed ?? 1;
    this.#classId = data.classId ?? '';
    this.#index = Math.max(0, DIFFICULTIES.findIndex((difficulty) => difficulty.id === 'midterm'));
    this.#gfx = this.add.graphics().setDepth(0);
    this.#render();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is required for difficulty select');
    this.#keyHandler = (event: KeyboardEvent): void => this.#onKeyDown(event);
    keyboard.on('keydown', this.#keyHandler);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.#onPointer(pointer));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.#keyHandler) this.input.keyboard?.off('keydown', this.#keyHandler);
      this.#clearLabels();
    });
  }

  #onKeyDown(event: KeyboardEvent): void {
    const code = event.keyCode;
    if (code === 38 || code === 87) {
      this.#index = (this.#index + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
      this.#render();
      return;
    }
    if (code === 40 || code === 83) {
      this.#index = (this.#index + 1) % DIFFICULTIES.length;
      this.#render();
      return;
    }
    if (code === 13 || code === 32) {
      this.#begin();
      return;
    }
    if (code === 27) {
      this.scene.start('Character', { slot: this.#slot, seed: this.#seed });
    }
  }

  #onPointer(pointer: Phaser.Input.Pointer): void {
    const row = Math.floor((pointer.y - ROW_TOP) / ROW_HEIGHT);
    if (row < 0 || row >= DIFFICULTIES.length) return;
    if (row === this.#index) {
      this.#begin();
      return;
    }
    this.#index = row;
    this.#render();
  }

  #begin(): void {
    const difficulty = DIFFICULTIES[this.#index];
    if (!difficulty) return;
    this.scene.start('Run', {
      seed: this.#seed,
      floor: 1,
      classId: this.#classId,
      difficultyId: difficulty.id,
      slot: this.#slot,
      smarts: 0,
      unlocked: [],
    });
  }

  #text(
    text: string,
    x: number,
    y: number,
    color: string,
    options: { width?: number; maxLines?: number; align?: 'left' | 'center' | 'right' } = {},
  ): void {
    const label = new PixelLabel(this, x, y, {
      text,
      color,
      width: options.width ?? 300,
      maxLines: options.maxLines ?? 1,
      align: options.align ?? 'left',
    }).setDepth(2);
    this.#labels.push(label);
  }

  #clearLabels(): void {
    for (const label of this.#labels) label.destroy();
    this.#labels = [];
  }

  #render(): void {
    this.#clearLabels();
    const graphics = this.#gfx;
    if (!graphics) return;
    graphics.clear();
    graphics.fillStyle(0x0b0f12, 1).fillRect(0, 0, VIEW_W, VIEW_H);
    graphics.fillStyle(0x1a2430, 1).fillRect(14, 12, VIEW_W - 28, VIEW_H - 24);
    graphics.lineStyle(1, 0xcfe3c0, 0.45).strokeRect(14.5, 12.5, VIEW_W - 29, VIEW_H - 25);
    graphics.fillStyle(0x4a76b8, 1).fillRect(14, 12, VIEW_W - 28, 2);

    const cls = CLASS_BY_ID.get(this.#classId);
    this.#text('HOW BAD IS IT', VIEW_W / 2, 20, '#e7c65b', { width: 420, align: 'center' });
    this.#text(cls ? `${cls.name.toUpperCase()} - ${cls.title}` : 'CHOOSE YOUR EXAM', VIEW_W / 2, 36, '#8c949a', {
      width: 420,
      align: 'center',
    });

    DIFFICULTIES.forEach((difficulty, index) => {
      const y = ROW_TOP + index * ROW_HEIGHT;
      const selected = index === this.#index;
      const accent = Number.parseInt(paletteHex(difficulty.accent).slice(1), 16);
      graphics.fillStyle(selected ? 0x233040 : 0x151d26, 1).fillRect(28, y, VIEW_W - 56, 38);
      if (selected) graphics.fillStyle(accent, 1).fillRect(28, y, 3, 38);
      this.#text(difficulty.name.toUpperCase(), 40, y + 4, selected ? '#e7c65b' : '#eef3e6', { width: 140 });
      this.#text(difficulty.tagline, 40, y + 17, '#8c949a', { width: 150 });
      this.#text(difficulty.description, 196, y + 4, '#b9c0c4', { width: 236, maxLines: 2 });
      const mods = `HP x${difficulty.enemyHpMultiplier.toFixed(2)}  DMG x${difficulty.enemyDamageMultiplier.toFixed(2)}  SMARTS x${difficulty.smartsMultiplier.toFixed(2)}`;
      this.#text(mods, VIEW_W - 40, y + 26, '#5f686f', { width: 210, align: 'right' });
    });

    this.#text('W/S SELECT   ENTER BEGIN   ESC BACK', VIEW_W / 2, VIEW_H - 24, '#5f686f', {
      width: 440,
      align: 'center',
    });
    this.#text('DIFFICULTY LOCKS FOR THE WHOLE RUN.', VIEW_W / 2, VIEW_H - 13, '#3a4148', {
      width: 440,
      align: 'center',
    });
  }
}
