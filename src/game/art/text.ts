/**
 * Canvas-backed bitmap text. Text is rasterised with the original 5x7 font and
 * kept in a cached texture per label, so no system font is ever used.
 */
import Phaser from 'phaser';
import { measureText, rasterizeText, wrapText, GLYPH_HEIGHT, LINE_SPACING } from './font';
import { PALETTE } from './palette';

let labelCounter = 0;

export interface LabelOptions {
  text: string;
  color?: string;
  scale?: number;
  width?: number;
  maxLines?: number;
  align?: 'left' | 'center' | 'right';
}

export class PixelLabel {
  readonly image: Phaser.GameObjects.Image;
  #scene: Phaser.Scene;
  #texture: Phaser.Textures.CanvasTexture;
  #key: string;
  #width: number;
  #height: number;
  #scale: number;
  #color: string;
  #maxLines: number;
  #align: 'left' | 'center' | 'right';
  #text = '';

  constructor(scene: Phaser.Scene, x: number, y: number, options: LabelOptions) {
    this.#scene = scene;
    this.#scale = options.scale ?? 1;
    this.#color = options.color ?? PALETTE.bone;
    this.#maxLines = options.maxLines ?? 6;
    this.#align = options.align ?? 'left';
    this.#width = options.width ?? 200;
    this.#height = Math.max(
      GLYPH_HEIGHT * this.#scale * Math.min(this.#maxLines, 2),
      this.#maxLines * (GLYPH_HEIGHT + LINE_SPACING) * this.#scale,
    );
    labelCounter += 1;
    this.#key = `pixel-label-${labelCounter}`;
    const texture = scene.textures.createCanvas(this.#key, this.#width, this.#height);
    if (!texture) {
      throw new Error('Could not allocate a canvas texture for bitmap text');
    }
    this.#texture = texture;
    // The label's x is its alignment anchor, so centred text centres on x and
    // right-aligned text ends at x. Without this, centred labels drawn as
    // x = viewWidth / 2 render their text box starting at the screen centre and
    // run off the right edge.
    const originX = this.#align === 'center' ? 0.5 : this.#align === 'right' ? 1 : 0;
    this.image = scene.add.image(x, y, this.#key).setOrigin(originX, 0);
    this.setText(options.text);
  }

  get text(): string {
    return this.#text;
  }

  setText(text: string): this {
    if (text === this.#text) return this;
    this.#text = text;
    this.#redraw();
    return this;
  }

  setColor(color: string): this {
    if (color === this.#color) return this;
    this.#color = color;
    this.#redraw();
    return this;
  }

  setVisible(visible: boolean): this {
    this.image.setVisible(visible);
    return this;
  }

  setDepth(depth: number): this {
    this.image.setDepth(depth);
    return this;
  }

  setScrollFactor(factor: number): this {
    this.image.setScrollFactor(factor);
    return this;
  }

  setPosition(x: number, y: number): this {
    this.image.setPosition(x, y);
    return this;
  }

  setAlpha(alpha: number): this {
    this.image.setAlpha(alpha);
    return this;
  }

  destroy(): void {
    this.image.destroy();
    if (this.#scene.textures.exists(this.#key)) {
      this.#scene.textures.remove(this.#key);
    }
  }

  #redraw(): void {
    const ctx = this.#texture.getContext();
    ctx.clearRect(0, 0, this.#width, this.#height);
    const lines = wrapText(this.#text, this.#width - 2, this.#scale).slice(0, this.#maxLines);
    let y = 0;
    for (const line of lines) {
      const raster = rasterizeText(line, this.#scale);
      const offsetX =
        this.#align === 'center'
          ? Math.max(0, Math.floor((this.#width - raster.width) / 2))
          : this.#align === 'right'
            ? Math.max(0, this.#width - raster.width)
            : 0;
      ctx.fillStyle = this.#color;
      for (let py = 0; py < raster.height; py += 1) {
        for (let px = 0; px < raster.width; px += 1) {
          if (raster.pixels[py * raster.width + px] === 1) {
            ctx.fillRect(offsetX + px, y + py, 1, 1);
          }
        }
      }
      y += (GLYPH_HEIGHT + LINE_SPACING) * this.#scale;
    }
    this.#texture.refresh();
  }
}

export function textWidth(text: string, scale = 1): number {
  return measureText(text, scale);
}
