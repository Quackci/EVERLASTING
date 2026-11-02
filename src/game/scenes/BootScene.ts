import Phaser from 'phaser';
import { generateArt } from '../art/sprites';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateArt(this);
    this.scene.start('Title');
  }
}
