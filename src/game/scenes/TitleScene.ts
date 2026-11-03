import Phaser from 'phaser';
import { BALANCE, THEMES } from '../content';
import { PixelLabel } from '../art/text';
import { randomSeed } from '../core/rng';
import { keyName, loadKeybinds } from '../systems/keybinds';

export class TitleScene extends Phaser.Scene {
  #seed = 1;
  #hint!: PixelLabel;
  #started = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.#started = false;
    this.#seed = randomSeed(Date.now() & 0xffffffff);
    this.cameras.main.setBackgroundColor('#0b0f12');

    const width = BALANCE.world.viewWidth;
    const height = BALANCE.world.viewHeight;
    const binds = loadKeybinds();

    const title = new PixelLabel(this, width / 2, 44, {
      text: 'EVERLASTING',
      color: '#f3ecd8',
      scale: 3,
      width: 460,
      maxLines: 1,
      align: 'center',
    });
    title.setScrollFactor(0);

    new PixelLabel(this, width / 2, 86, {
      text: 'INFINITE HALLWAYS',
      color: '#a9c4a0',
      scale: 2,
      width: 460,
      maxLines: 1,
      align: 'center',
    });

    new PixelLabel(this, width / 2, 118, {
      text: 'SCHOOL SUPPLIES ARE WEAPONS.\nKNOWLEDGE IS POWER.',
      color: '#b9c0c4',
      scale: 1,
      width: 460,
      maxLines: 2,
      align: 'center',
    });

    new PixelLabel(this, 24, 152, {
      text: `${keyName(binds.up)}${keyName(binds.left)}${keyName(binds.down)}${keyName(binds.right)} / ARROWS  MOVE\n${keyName(binds.attack)} / RIGHT CLICK  SWING     LEFT CLICK  GUARD\n${keyName(binds.interact)}  OPEN DESK / LOCKER   ${keyName(binds.inventory)}  INVENTORY`,
      color: '#8c949a',
      scale: 1,
      width: 300,
      maxLines: 3,
    });

    new PixelLabel(this, width - 24, 152, {
      text: `SEED ${this.#seed}\n9 THEMES  -  10 FLOORS\nNO NETWORK. NO ADS.`,
      color: '#5f686f',
      scale: 1,
      width: 170,
      maxLines: 3,
      align: 'right',
    });

    this.#hint = new PixelLabel(this, width / 2, height - 34, {
      text: 'PRESS ENTER TO ENROLL',
      color: '#e7c65b',
      scale: 1,
      width: 460,
      maxLines: 1,
      align: 'center',
    });

    new PixelLabel(this, width / 2, height - 18, {
      text: 'C  CONTROLS & KEYBINDS',
      color: '#5f686f',
      scale: 1,
      width: 460,
      maxLines: 1,
      align: 'center',
    });

    this.tweens.add({
      targets: this.#hint.image,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    const decorTheme = THEMES[0]?.id ?? 'classroom';
    for (let i = 0; i < 10; i += 1) {
      const key = `tile-${decorTheme}-floor-${i % 4}`;
      if (this.textures.exists(key)) {
        this.add.image(16 + i * 16, 200, key).setAlpha(0.18);
        this.add.image(16 + i * 16, 216, key).setAlpha(0.1);
      }
    }

    const start = (): void => {
      if (this.#started) return;
      this.#started = true;
      this.scene.start('SaveSelect');
    };

    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.keyboard?.once('keydown-C', () => {
      this.scene.start('Settings', { from: 'Title' });
    });
    this.input.once('pointerdown', start);
  }
}
