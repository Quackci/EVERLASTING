import Phaser from 'phaser';
import { BALANCE, CLASS_BY_ID, DIFFICULTY_BY_ID } from '../content';
import { PixelLabel } from '../art/text';
import { randomSeed } from '../core/rng';
import { SAVE_SLOTS, clearSlot, listSlots, type RunSave } from '../systems/save';

const VIEW_W = BALANCE.world.viewWidth;
const VIEW_H = BALANCE.world.viewHeight;
const ROW_TOP = 74;
const ROW_HEIGHT = 54;

export class SaveSelectScene extends Phaser.Scene {
  #index = 0;
  #saves: (RunSave | null)[] = [];
  #gfx?: Phaser.GameObjects.Graphics;
  #labels: PixelLabel[] = [];
  #keyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super('SaveSelect');
  }

  create(): void {
    this.#index = 0;
    this.#saves = listSlots();
    this.#gfx = this.add.graphics().setDepth(0);
    this.#render();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is required for the save screen');
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
      this.#index = (this.#index + SAVE_SLOTS - 1) % SAVE_SLOTS;
      this.#render();
      return;
    }
    if (code === 40 || code === 83) {
      this.#index = (this.#index + 1) % SAVE_SLOTS;
      this.#render();
      return;
    }
    if (code === 13 || code === 32) {
      this.#activate();
      return;
    }
    if (code === 78) {
      this.#newRun();
      return;
    }
    if (code === 46) {
      clearSlot(this.#index + 1);
      this.#saves = listSlots();
      this.#render();
      return;
    }
    if (code === 27) this.scene.start('Title');
  }

  #onPointer(pointer: Phaser.Input.Pointer): void {
    const row = Math.floor((pointer.y - ROW_TOP) / ROW_HEIGHT);
    if (row < 0 || row >= SAVE_SLOTS) return;
    if (row === this.#index) {
      this.#activate();
      return;
    }
    this.#index = row;
    this.#render();
  }

  #activate(): void {
    const save = this.#saves[this.#index];
    if (!save) {
      this.#newRun();
      return;
    }
    this.scene.start('Run', {
      seed: save.seed,
      floor: save.floor,
      classId: save.classId,
      difficultyId: save.difficultyId,
      slot: save.slot,
      smarts: save.smarts,
      unlocked: save.unlocked,
      hp: save.hp,
    });
  }

  #newRun(): void {
    const slot = this.#index + 1;
    clearSlot(slot);
    this.scene.start('Character', { slot, seed: randomSeed(Date.now() & 0xffffffff) });
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
    graphics.lineStyle(1, 0xcfe3c0, 0.5).strokeRect(14.5, 12.5, VIEW_W - 29, VIEW_H - 25);
    graphics.fillStyle(0x4a76b8, 1).fillRect(14, 12, VIEW_W - 28, 2);

    this.#text('CHOOSE A LOCKER', VIEW_W / 2, 20, '#e7c65b', { width: 420, align: 'center' });
    this.#text('THREE SAVES. THREE CHANCES TO GRADUATE.', VIEW_W / 2, 36, '#8c949a', {
      width: 420,
      align: 'center',
    });

    for (let i = 0; i < SAVE_SLOTS; i += 1) {
      const y = ROW_TOP + i * ROW_HEIGHT;
      const selected = i === this.#index;
      graphics.fillStyle(selected ? 0x233040 : 0x151d26, 1).fillRect(26, y, VIEW_W - 52, 46);
      if (selected) graphics.fillStyle(0xe7c65b, 1).fillRect(26, y, 3, 46);
      this.#text(`SLOT ${i + 1}`, 36, y + 6, selected ? '#e7c65b' : '#8c949a', { width: 70 });

      const save = this.#saves[i];
      if (!save) {
        this.#text('EMPTY', 112, y + 6, '#5f686f', { width: 120 });
        this.#text('ENTER TO ENROLL', 36, y + 24, '#a9c4a0', { width: 260 });
        continue;
      }
      const cls = CLASS_BY_ID.get(save.classId);
      const difficulty = DIFFICULTY_BY_ID.get(save.difficultyId);
      this.#text(`${cls?.name.toUpperCase() ?? save.classId} - ${cls?.title ?? ''}`, 112, y + 6, '#eef3e6', {
        width: 250,
      });
      this.#text(
        `FLOOR ${save.floor}  ${difficulty?.name.toUpperCase() ?? save.difficultyId}  ${save.smarts} SMARTS`,
        112,
        y + 23,
        '#a9c4a0',
        { width: 270 },
      );
      this.#text(`HP ${save.hp}/${save.maxHp}`, VIEW_W - 36, y + 6, '#b9c0c4', { width: 100, align: 'right' });
      this.#text(new Date(save.updatedAt).toLocaleDateString(), VIEW_W - 36, y + 23, '#5f686f', {
        width: 100,
        align: 'right',
      });
    }

    this.#text('W/S SELECT   ENTER PLAY   N NEW RUN   DEL ERASE   ESC BACK', VIEW_W / 2, VIEW_H - 32, '#5f686f', {
      width: 440,
      align: 'center',
    });
    this.#text('THE RUN IS SAVED EACH TIME YOU ENTER A FLOOR.', VIEW_W / 2, VIEW_H - 20, '#3a4148', {
      width: 440,
      align: 'center',
    });
  }
}
