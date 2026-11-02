#!/usr/bin/env node
/**
 * electron-builder `afterPack` hook for the Windows executable.
 *
 * electron-builder's built-in PE resource editing shells out to Wine when the
 * build host is Linux, which this environment does not have. Instead of
 * requiring Wine, this hook stamps the icon and version strings itself using
 * `resedit`, a pure-JavaScript PE editor with no native dependencies. The same
 * hook runs unchanged on Windows and macOS, so every host ships an identical
 * executable. `win.signAndEditExecutable` is off so the built-in path never
 * runs (and never needs Wine); signing is still skipped, as the project has no
 * code-signing certificate.
 */
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { Data, NtExecutable, NtExecutableResource, Resource } from 'resedit';

const PRODUCT_NAME = 'Everlasting Infinite Hallways';
const COMPANY = 'Everlasting Team';
const COPYRIGHT = 'Copyright (c) 2026 Everlasting Team';
const DESCRIPTION = 'A top-down pixel-art school roguelike. Supplies are weapons; knowledge is power.';
const LANGUAGE = { lang: 1033, codepage: 1200 }; // en-US, Unicode

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const projectDir = context.packager?.projectDir ?? process.cwd();
  const iconPath = path.join(projectDir, 'build', 'icon.ico');
  const version = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8')).version;

  if (!fs.existsSync(iconPath)) {
    throw new Error(`Missing ${iconPath} - run "npm run icon" before packaging`);
  }
  // `icons` holds IconFileItem wrappers; the group entry wants the raw items.
  const icons = Data.IconFile.from(fs.readFileSync(iconPath)).icons.map((item) => item.data);

  const executables = fs
    .readdirSync(context.appOutDir)
    .filter((name) => name.toLowerCase().endsWith('.exe'));

  if (executables.length === 0) {
    throw new Error(`No .exe found in ${context.appOutDir} to stamp`);
  }

  for (const name of executables) {
    const exePath = path.join(context.appOutDir, name);
    const exe = NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
    const resources = NtExecutableResource.from(exe);

    const groups = Resource.IconGroupEntry.fromEntries(resources.entries);
    for (const group of groups) {
      Resource.IconGroupEntry.replaceIconsForResource(resources.entries, group.id, group.lang, icons);
    }

    const [versionInfo] = Resource.VersionInfo.fromEntries(resources.entries);
    if (versionInfo) {
      versionInfo.setFileVersion(`${version}.0`);
      versionInfo.setProductVersion(`${version}.0`);
      versionInfo.setStringValues(LANGUAGE, {
        Comments: DESCRIPTION,
        CompanyName: COMPANY,
        FileDescription: PRODUCT_NAME,
        FileVersion: version,
        InternalName: 'everlasting-infinite-hallways',
        LegalCopyright: COPYRIGHT,
        OriginalFilename: name,
        ProductName: PRODUCT_NAME,
        ProductVersion: version,
      });
      versionInfo.outputToResourceEntries(resources.entries);
    }

    resources.outputResource(exe);
    fs.writeFileSync(exePath, Buffer.from(exe.generate()));

    console.log(
      `afterPack: stamped ${name} (icon groups: ${groups.length}, versions: ${versionInfo ? 'yes' : 'none'})`,
    );
  }
}
