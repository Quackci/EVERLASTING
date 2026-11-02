/** Contract shared by the Electron main process, the preload bridge and the renderer. */

export const IPC = {
  saveRead: 'save:read',
  saveWrite: 'save:write',
  settingsRead: 'settings:read',
  settingsWrite: 'settings:write',
  quit: 'app:quit',
  platform: 'app:platform',
} as const;

export interface FileResult {
  ok: boolean;
  data: string | null;
  error: string | null;
}

export interface SlotFileResult extends FileResult {
  slot: number;
}

export interface SaveBridge {
  read(slot: number): Promise<FileResult>;
  write(slot: number, data: string): Promise<FileResult>;
  list(): Promise<SlotFileResult[]>;
}

export interface SettingsBridge {
  read(): Promise<FileResult>;
  write(data: string): Promise<FileResult>;
}

export interface AppBridge {
  save: SaveBridge;
  settings: SettingsBridge;
  platform: NodeJS.Platform | 'browser';
  quit(): void;
}

export const SAVE_SLOTS = 3;
