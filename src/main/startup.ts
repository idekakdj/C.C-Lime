import path from 'node:path';
import type { LoginItemSettings, LoginItemSettingsOptions } from 'electron';

export const STARTUP_NAME = 'C.C. Lime';
export const STARTUP_ARGS = ['--background'];
// Electron's Chromium GetArgs() excludes switches from launchItems.args.
// This field cannot prove the raw Run command contains --background.
const RETURNED_ARGS = STARTUP_ARGS.filter(arg => !arg.startsWith('--'));
export function startupQuery(platform: string, launcher: string): LoginItemSettingsOptions {
  // Pinned Electron parses this as a command line when enumerating entries.
  return { path: platform === 'win32' ? `"${launcher}"` : launcher, args: [...STARTUP_ARGS] };
}
export function startupState(platform: string, launcher: string, settings: Pick<LoginItemSettings,'openAtLogin'|'wasOpenedAtLogin'|'launchItems'>, name=STARTUP_NAME) {
  if (platform !== 'win32') return { registered: settings.openAtLogin, enabled: settings.openAtLogin, wasOpenedAtLogin: settings.wasOpenedAtLogin };
  const entry = settings.launchItems.find(item =>
    item.name === name && item.scope === 'user' &&
    path.win32.normalize(item.path).toLowerCase() === path.win32.normalize(launcher).toLowerCase() &&
    item.args.length === RETURNED_ARGS.length && item.args.every((arg,i) => arg === RETURNED_ARGS[i]));
  return { registered: !!entry, enabled: entry?.enabled === true, wasOpenedAtLogin: false };
}
