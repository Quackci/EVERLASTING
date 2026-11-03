import Phaser from 'phaser';
import { BALANCE } from './content';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { RunScene } from './scenes/RunScene';
import { SettingsScene } from './scenes/SettingsScene';
import { SaveSelectScene } from './scenes/SaveSelectScene';
import { CharacterScene } from './scenes/CharacterScene';
import { DifficultyScene } from './scenes/DifficultyScene';

const viewWidth = BALANCE.world.viewWidth;
const viewHeight = BALANCE.world.viewHeight;

const bootStatus = document.getElementById('boot-status');

function showFatal(message: string): void {
  if (!bootStatus) return;
  bootStatus.classList.remove('hidden');
  bootStatus.textContent = `The hallway would not open.\n${message}`;
  bootStatus.style.whiteSpace = 'pre-wrap';
}

let game: Phaser.Game | null = null;

try {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: viewWidth,
    height: viewHeight,
    backgroundColor: '#0b0f12',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: viewWidth,
      height: viewHeight,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
        fps: 60,
      },
    },
    render: {
      powerPreference: 'high-performance',
      batchSize: 2048,
    },
    scene: [BootScene, TitleScene, SaveSelectScene, CharacterScene, DifficultyScene, SettingsScene, RunScene],
  });
} catch (error) {
  showFatal(error instanceof Error ? error.message : String(error));
}

/** Integer scaling keeps pixels square and avoids shimmer at 125% / 150% Windows scaling. */
function applyIntegerScale(): void {
  if (!game?.canvas) return;
  const availableWidth = Math.max(window.innerWidth, viewWidth);
  const availableHeight = Math.max(window.innerHeight, viewHeight);
  const zoom = Math.max(1, Math.floor(Math.min(availableWidth / viewWidth, availableHeight / viewHeight)));
  game.canvas.style.width = `${viewWidth * zoom}px`;
  game.canvas.style.height = `${viewHeight * zoom}px`;
  game.canvas.style.imageRendering = 'pixelated';
}

if (game) {
  game.events.once(Phaser.Core.Events.READY, () => {
    bootStatus?.classList.add('hidden');
    applyIntegerScale();
  });
}

window.addEventListener('resize', applyIntegerScale);
window.addEventListener('orientationchange', applyIntegerScale);

window.addEventListener('error', (event) => {
  if (!bootStatus) return;
  showFatal(event.message || 'Unknown startup error');
});

window.addEventListener('unhandledrejection', (event) => {
  if (!bootStatus) return;
  showFatal(String(event.reason));
});
