import Phaser from 'phaser';
import { BALANCE } from '../content';
import { PixelLabel } from '../art/text';
import {
  BIND_ACTIONS,
  BIND_LABELS,
  assignBind,
  defaultKeybinds,
  keyName,
  loadKeybinds,
  resetKeybinds,
  saveKeybinds,
  type BindAction,
  type Keybinds,
} from '../systems/keybinds';

interface SettingsData {
  from?: 'Title' | 'Run';
}

const VIEW_W = BALANCE.world.viewWidth;
const VIEW_H = BALANCE.world.viewHeight;
const ROW_START = 56;
const ROW_HEIGHT = 14;

export class SettingsScene extends Phaser.Scene {
  #from: 'Title' | 'Run' = 'Title';
  #binds: Keybinds = defaultKeybinds();
  #index = 0;
  #capturing: BindAction | null = null;
  #message = '';
  #gfx?: Phaser.GameObjects.Graphics;
  #labels: PixelLabel[] = [];
  #keyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super('Settings');
  }

  create(data: SettingsData = {}): void {
    this.#from = data.from ?? 'Title';
    this.#binds = loadKeybinds();
    this.#index = 0;
    this.#capturing = null;
    this.#message = 'PRESS A ROW, THEN PRESS THE KEY YOU WANT.';

    this.cameras.main.setBackgroundColor('#0b0f12');
    this.#gfx = this.add.graphics().setDepth(0);
    this.#render();

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is required to rebind keys');
    }
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

    if (this.#capturing) {
      event.preventDefault();
      if (code === 27) {
        this.#capturing = null;
        this.#message = 'REBIND CANCELLED.';
        this.#render();
        return;
      }
      const action = this.#capturing;
      const result = assignBind(this.#binds, action, code);
      if (result.accepted) {
        this.#binds = result.binds;
        saveKeybinds(this.#binds);
        this.#capturing = null;
        this.#message = `${BIND_LABELS[action]} IS NOW ${keyName(code)}.`;
      } else if (result.conflict) {
        this.#message = `${keyName(code)} IS ALREADY ${BIND_LABELS[result.conflict]}.`;
      } else {
        this.#message = 'THAT KEY CANNOT BE USED.';
      }
      this.#render();
      return;
    }

    if (code === 38 || code === 87) {
      this.#index = (this.#index + BIND_ACTIONS.length - 1) % BIND_ACTIONS.length;
      this.#message = 'PRESS ENTER TO REBIND.';
      this.#render();
      return;
    }
    if (code === 40 || code === 83) {
      this.#index = (this.#index + 1) % BIND_ACTIONS.length;
      this.#message = 'PRESS ENTER TO REBIND.';
      this.#render();
      return;
    }
    if (code === 13 || code === 32) {
      event.preventDefault();
      this.#capturing = BIND_ACTIONS[this.#index] ?? 'up';
      this.#message = `PRESS A NEW KEY FOR ${BIND_LABELS[this.#capturing]}...`;
      this.#render();
      return;
    }
    if (code === 82) {
      this.#binds = resetKeybinds();
      this.#message = 'DEFAULTS RESTORED.';
      this.#render();
      return;
    }
    if (code === 27) {
      this.#close();
    }
  }

  #onPointer(pointer: Phaser.Input.Pointer): void {
    const row = Math.floor((pointer.y - ROW_START) / ROW_HEIGHT);
    if (row >= 0 && row < BIND_ACTIONS.length) {
      if (this.#capturing && this.#index === row) {
        return;
      }
      this.#index = row;
      this.#capturing = BIND_ACTIONS[row] ?? 'up';
      this.#message = `PRESS A NEW KEY FOR ${BIND_LABELS[this.#capturing]}...`;
      this.#render();
      return;
    }
    if (pointer.y >= VIEW_H - 30) {
      if (pointer.x < VIEW_W / 2) {
        this.#binds = resetKeybinds();
        this.#message = 'DEFAULTS RESTORED.';
        this.#render();
      } else {
        this.#close();
      }
    }
  }

  #close(): void {
    if (this.#from === 'Run') {
      this.scene.stop();
      this.scene.resume('Run');
      return;
    }
    this.scene.start('Title');
  }

  #clearLabels(): void {
    for (const label of this.#labels) label.destroy();
    this.#labels = [];
  }

  #text(
    text: string,
    x: number,
    y: number,
    color: string,
    options: { width?: number; maxLines?: number; align?: 'left' | 'center' | 'right'; scale?: number } = {},
  ): PixelLabel {
    const label = new PixelLabel(this, x, y, {
      text,
      color,
      width: options.width ?? 300,
      maxLines: options.maxLines ?? 1,
      align: options.align ?? 'left',
      scale: options.scale ?? 1,
    }).setDepth(2);
    this.#labels.push(label);
    return label;
  }

  #render(): void {
    this.#clearLabels();
    const graphics = this.#gfx;
    if (!graphics) return;
    graphics.clear();

    graphics.fillStyle(0x0b0f12, 1).fillRect(0, 0, VIEW_W, VIEW_H);
    graphics.fillStyle(0x1a2430, 1).fillRect(16, 14, VIEW_W - 32, VIEW_H - 28);
    graphics.lineStyle(1, 0xcfe3c0, 0.5).strokeRect(16.5, 14.5, VIEW_W - 33, VIEW_H - 29);
    graphics.fillStyle(0x4a76b8, 1).fillRect(16, 14, VIEW_W - 32, 2);

    this.#text('CONTROLS & KEYBINDS', VIEW_W / 2, 22, '#e7c65b', { width: 400, align: 'center', scale: 1 });
    this.#text('WASD AND ARROWS ALWAYS MOVE. LEFT CLICK ALWAYS BLOCKS.', VIEW_W / 2, 36, '#8c949a', {
      width: 430,
      align: 'center',
    });

    BIND_ACTIONS.forEach((action, index) => {
      const y = ROW_START + index * ROW_HEIGHT;
      const selected = index === this.#index;
      const capturing = this.#capturing === action;
      if (selected) {
        graphics.fillStyle(0x233040, 1).fillRect(26, y - 3, VIEW_W - 52, ROW_HEIGHT - 1);
        graphics.fillStyle(0xe7c65b, 1).fillRect(26, y - 3, 2, ROW_HEIGHT - 1);
      }
      this.#text(BIND_LABELS[action], 36, y, selected ? '#e7c65b' : '#b9c0c4', { width: 240 });
      const value = capturing ? 'PRESS A KEY...' : keyName(this.#binds[action]);
      this.#text(value, VIEW_W - 36, y, capturing ? '#e7c65b' : selected ? '#eef3e6' : '#8c949a', {
        width: 190,
        align: 'right',
      });
    });

    this.#text(this.#message, 26, VIEW_H - 46, '#a9c4a0', { width: VIEW_W - 52, maxLines: 2 });

    const resetY = VIEW_H - 22;
    graphics.fillStyle(0x233040, 1).fillRect(26, resetY - 4, 130, 16);
    graphics.fillStyle(0x233040, 1).fillRect(VIEW_W - 156, resetY - 4, 130, 16);
    this.#text('R  RESET', 36, resetY, '#b9c0c4', { width: 120 });
    this.#text('ESC  BACK', VIEW_W - 36, resetY, '#cfe3c0', { width: 120, align: 'right' });

    graphics.fillStyle(0x1a2430, 1).fillRect(16, VIEW_H - 8, VIEW_W - 32, 2);
  }
}
