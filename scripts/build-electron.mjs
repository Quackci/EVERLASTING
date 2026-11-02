#!/usr/bin/env node
// Bundles the Electron main process and preload script to CommonJS.
// Kept dependency-light on purpose: no native modules, no postinstall compilation.
import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const outdir = path.resolve('dist-electron');

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  sourcemap: false,
  minify: false,
  logLevel: 'info',
};

await build({
  ...shared,
  entryPoints: ['src/main/main.ts'],
  outfile: path.join(outdir, 'main.cjs'),
});

await build({
  ...shared,
  entryPoints: ['src/preload/preload.ts'],
  outfile: path.join(outdir, 'preload.cjs'),
});

console.log('Electron bundles written to dist-electron/');
