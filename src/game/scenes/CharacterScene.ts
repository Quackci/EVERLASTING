import Phaser from 'phaser';
import { BALANCE, CLASSES, ITEM_BY_ID } from '../content';
import { PixelLabel } from '../art/text';
import { paletteHex } from '../art/sprites';
import { playerTextureKey } from '../art/classSprites';

const VIEW_W = BALANCE.world.viewWidth;
const VIEW_H = BALANCE.world.viewHeight;
const CARD_WIDTH = 104;
const CARD_GAP = 10;
const CARD_TOP = 54;

interface CharacterData {
  slot?: number;
  seed?: number;
}

export class CharacterScene extends Phaser.Scene {
  #index = 0;
  #slot = 1;
  #seed = 1;
  #gfx?: Phaser.GameObjects.Graphics;
  #labels: PixelLabel[] = [];
  #previews: Phaser.GameObjects.Image[] = [];
  #keyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super('Character');
  }

  create(data: CharacterData = {}): void {
    this.#index = 0;
    this.#slot = data.slot ?? 1;
    this.#seed = data.seed ?? 1;
    this.#gfx = this.add.graphics().setDepth(0);
    this.#render();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is required for character select');
    this.#keyHandler = (event: KeyboardEvent): void => this.#onKeyDown(event);
    keyboard.on('keydown', this.#keyHandler);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.#onPointer(pointer));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.#keyHandler) this.input.keyboard?.off('keydown', this.#keyHandler);
      this.#clearLabels();
      this.#clearPreviews();
    });
  }

  #onKeyDown(event: KeyboardEvent): void {
    const code = event.keyCode;
    if (code === 37 || code === 65) {
      this.#index = (this.#index + CLASSES.length - 1) % CLASSES.length;
      this.#render();
      return;
    }
    if (code === 39 || code === 68) {
      this.#index = (this.#index + 1) % CLASSES.length;
      this.#render();
      return;
    }
    if (code === 13 || code === 32) {
      this.#choose();
      return;
    }
    if (code === 27) this.scene.start('SaveSelect');
  }

  #onPointer(pointer: Phaser.Input.Pointer): void {
    const startX = (VIEW_W - (CARD_WIDTH * CLASSES.length + CARD_GAP * (CLASSES.length - 1))) / 2;
    const column = Math.floor((pointer.x - startX) / (CARD_WIDTH + CARD_GAP));
    if (column < 0 || column >= CLASSES.length) return;
    if (pointer.y < CARD_TOP || pointer.y > CARD_TOP + 168) return;
    if (column === this.#index) {
      this.#choose();
      return;
    }
    this.#index = column;
    this.#render();
  }

  #choose(): void {
    const cls = CLASSES[this.#index];
    if (!cls) return;
    this.scene.start('Difficulty', { slot: this.#slot, seed: this.#seed, classId: cls.id });
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
      width: options.width ?? 96,
      maxLines: options.maxLines ?? 1,
      align: options.align ?? 'left',
    }).setDepth(2);
    this.#labels.push(label);
  }

  #clearLabels(): void {
    for (const label of this.#labels) label.destroy();
    this.#labels = [];
  }

  #clearPreviews(): void {
    for (const preview of this.#previews) preview.destroy();
    this.#previews = [];
  }

  #render(): void {
    this.#clearLabels();
    this.#clearPreviews();
    const graphics = this.#gfx;
    if (!graphics) return;
    graphics.clear();
    graphics.fillStyle(0x0b0f12, 1).fillRect(0, 0, VIEW_W, VIEW_H);
    graphics.fillStyle(0x1a2430, 1).fillRect(12, 12, VIEW_W - 24, VIEW_H - 24);
    graphics.lineStyle(1, 0xcfe3c0, 0.45).strokeRect(12.5, 12.5, VIEW_W - 25, VIEW_H - 25);
    graphics.fillStyle(0x4a76b8, 1).fillRect(12, 12, VIEW_W - 24, 2);

    this.#text('PICK YOUR STUDENT', VIEW_W / 2, 20, '#e7c65b', { width: 420, align: 'center' });
    this.#text('DIFFERENT ROLE, DIFFERENT BAD HABITS.', VIEW_W / 2, 34, '#8c949a', {
      width: 420,
      align: 'center',
    });

    const startX = (VIEW_W - (CARD_WIDTH * CLASSES.length + CARD_GAP * (CLASSES.length - 1))) / 2;
    CLASSES.forEach((cls, index) => {
      const x = startX + index * (CARD_WIDTH + CARD_GAP);
      const selected = index === this.#index;
      const accent = Number.parseInt(paletteHex(cls.accent).slice(1), 16);
      graphics.fillStyle(selected ? 0x233040 : 0x151d26, 1).fillRect(x, CARD_TOP, CARD_WIDTH, 168);
      graphics.lineStyle(1, selected ? accent : 0x2f4055, 1);
      graphics.strokeRect(x + 0.5, CARD_TOP + 0.5, CARD_WIDTH - 1, 167);
      if (selected) graphics.fillStyle(accent, 1).fillRect(x, CARD_TOP, CARD_WIDTH, 2);

      const weapon = ITEM_BY_ID.get(cls.weaponId);
      const hp = Math.round(BALANCE.player.baseHp * cls.hpMultiplier);
      const speed = Math.round(BALANCE.player.moveSpeed * cls.moveSpeedMultiplier);

      // Each card shows the class's actual in-game sprite so the look is
      // obvious before a run starts, not just the stats.
      const preview = this.add
        .image(x + CARD_WIDTH - 18, CARD_TOP + 20, playerTextureKey(cls.id, 'down', 0))
        .setScale(1.5)
        .setDepth(1);
      if (!selected) preview.setAlpha(0.72);
      this.#previews.push(preview);

      this.#text(cls.title, x + 6, CARD_TOP + 6, selected ? '#e7c65b' : '#8c949a', { width: 66 });
      this.#text(cls.name.toUpperCase(), x + 6, CARD_TOP + 16, '#eef3e6', { width: 66, maxLines: 2 });
      this.#text(`HP ${hp}  SPD ${speed}`, x + 6, CARD_TOP + 42, '#a9c4a0', { width: 92 });
      this.#text(`DMG ${weapon?.damage ?? 0}`, x + 6, CARD_TOP + 52, '#8c949a', { width: 92 });
      this.#text('PROS', x + 6, CARD_TOP + 68, '#6fae5f', { width: 92 });
      cls.pros.slice(0, 2).forEach((pro, line) => {
        this.#text(`+ ${pro}`, x + 6, CARD_TOP + 78 + line * 18, '#a9c4a0', { width: 92, maxLines: 2 });
      });
      this.#text('CONS', x + 6, CARD_TOP + 116, '#c8453f', { width: 92 });
      cls.cons.slice(0, 2).forEach((con, line) => {
        this.#text(`- ${con}`, x + 6, CARD_TOP + 126 + line * 18, '#e8736a', { width: 92, maxLines: 2 });
      });
    });

    this.#text('A/D SELECT   ENTER CONFIRM   ESC BACK', VIEW_W / 2, VIEW_H - 26, '#5f686f', {
      width: 440,
      align: 'center',
    });
    this.#text(CLASSES[this.#index]?.blurb ?? '', VIEW_W / 2, VIEW_H - 14, '#8c949a', {
      width: 440,
      align: 'center',
    });
  }
}
