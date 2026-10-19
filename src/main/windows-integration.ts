import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import type { ShortcutDetails } from 'electron';

// Public, stable application identities. Keep the installed value across upgrades.
export const WINDOWS_IDENTITIES = {
  installed: { name: 'C.C. Lime', id: 'com.squirrel.cc_lime.cc-lime', clsid: '{66FCBB1E-9C63-405A-843E-2DD4028426BC}' },
  preview: { name: 'C.C. Lime Preview', id: 'app.cclime.preview', clsid: '{EC79E8D8-CCF2-40F8-A387-2E831E2DD51F}' },
  test: { name: 'C.C. Lime Test', id: 'app.cclime.test', clsid: '{C975E806-D4DE-4AA0-9FCA-C15B968049B4}' },
} as const;
const win = path.win32;
const samePath = (a: string, b: string) => win.normalize(a).toLowerCase() === win.normalize(b).toLowerCase();
export interface WindowsInstallation { executable: string; directory: string; launcher: string; updater: string }
export function squirrelInstallation(platform: string, packaged: boolean, executable: string, isFile: (file: string) => boolean): WindowsInstallation | null {
  if (platform !== 'win32' || !packaged || win.basename(executable).toLowerCase() !== 'cc-lime.exe') return null;
  const directory = win.dirname(executable);
  if (!/^app-\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/i.test(win.basename(directory))) return null;
  const launcher = win.join(win.dirname(directory), 'cc-lime.exe'), updater = win.join(win.dirname(directory), 'Update.exe');
  return [executable, launcher, updater].every(isFile) ? { executable, directory, launcher, updater } : null;
}
export function isRegularFile(file: string) { try { return fs.statSync(file).isFile(); } catch { return false; } }

export interface ShortcutIO {
  exists(file: string): boolean;
  read(file: string): ShortcutDetails;
  write(file: string, operation: 'create' | 'update', details: ShortcutDetails): boolean;
  backup(file: string, destination: string): void;
  mkdir(directory: string): void;
  remove(file: string): void;
}
export function shortcutIO(shell: Pick<Electron.Shell, 'readShortcutLink' | 'writeShortcutLink'>): ShortcutIO {
  return {
    exists: fs.existsSync, read: file => shell.readShortcutLink(file),
    write: (file, operation, details) => shell.writeShortcutLink(file, operation, details),
    backup: (file, destination) => {
      fs.mkdirSync(win.dirname(destination), { recursive: true });
      try { fs.copyFileSync(file, destination, fs.constants.COPYFILE_EXCL); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    },
    mkdir: directory => { fs.mkdirSync(directory, { recursive: true }); },
    remove: file => fs.unlinkSync(file),
  };
}
export interface ShortcutLocations { appData: string; desktop: string; profile: string }
function locations(paths: ShortcutLocations) {
  const programs = win.join(paths.appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
  return [
    { file: win.join(programs, 'C.C. Lime.lnk'), key: 'root', required: true },
    { file: win.join(programs, 'idekakdj', 'C.C. Lime.lnk'), key: 'installer', required: false },
    { file: win.join(paths.desktop, 'C.C. Lime.lnk'), key: 'desktop', required: false },
  ];
}
function owned(details: ShortcutDetails) {
  return details.appUserModelId === WINDOWS_IDENTITIES.installed.id && win.basename(details.target).toLowerCase() === 'cc-lime.exe';
}
function matching(actual: ShortcutDetails, expected: ShortcutDetails) {
  return samePath(actual.target, expected.target) && samePath(actual.cwd ?? '', expected.cwd ?? '') &&
    samePath(actual.icon ?? '', expected.icon ?? '') && actual.iconIndex === expected.iconIndex &&
    actual.appUserModelId === expected.appUserModelId && actual.toastActivatorClsid?.toUpperCase() === expected.toastActivatorClsid &&
    (actual.args ?? '') === (expected.args ?? '');
}
export function repairInstalledShortcuts(installation: WindowsInstallation, paths: ShortcutLocations, io: ShortcutIO) {
  const edits: Array<{ file: string; key: string; previous?: ShortcutDetails; expected: ShortcutDetails }> = [];
  // Inspect every location before changing anything. A name collision is not proof of ownership.
  for (const location of locations(paths)) {
    const previous = io.exists(location.file) ? io.read(location.file) : undefined;
    if (previous && !owned(previous)) throw new Error('A C.C. Lime shortcut belongs to another application.');
    if (!previous && !location.required) continue;
    const expected: ShortcutDetails = {
      ...previous, target: installation.launcher, cwd: installation.directory, args: previous?.args ?? '',
      description: 'C.C. Lime', icon: installation.launcher, iconIndex: 0,
      appUserModelId: WINDOWS_IDENTITIES.installed.id, toastActivatorClsid: WINDOWS_IDENTITIES.installed.clsid,
    };
    if (!previous || !matching(previous, expected)) edits.push({ ...location, previous, expected });
  }
  for (const edit of edits) {
    if (edit.previous) io.backup(edit.file, win.join(paths.profile, 'shortcut-backups', `${edit.key}-before-repair.lnk`));
    io.mkdir(win.dirname(edit.file));
    if (!io.write(edit.file, edit.previous ? 'update' : 'create', edit.expected) || !matching(io.read(edit.file), edit.expected))
      throw new Error('Windows could not update the C.C. Lime notification shortcut.');
  }
  return edits.length;
}
export function removeInstalledRootShortcut(installation: WindowsInstallation, paths: ShortcutLocations, io: ShortcutIO) {
  const root = locations(paths)[0].file;
  if (!io.exists(root)) return;
  const details = io.read(root);
  // Another installed copy or an unrelated shortcut must survive this uninstall.
  if (owned(details) && samePath(details.target, installation.launcher)) io.remove(root);
}

type Lifecycle = 'install' | 'updated' | 'uninstall' | 'obsolete';
export function squirrelEvent(platform: string, args: string[]): Lifecycle | null {
  if (platform !== 'win32') return null;
  const value = args[1];
  return value === '--squirrel-install' ? 'install' : value === '--squirrel-updated' ? 'updated' :
    value === '--squirrel-uninstall' ? 'uninstall' : value === '--squirrel-obsolete' ? 'obsolete' : null;
}
export function runUpdater(executable: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => execFile(executable, args, { windowsHide: true, timeout: 20000 }, error => {
    if (error) reject(new Error('Windows installer shortcut setup failed.')); else resolve();
  }));
}
export async function handleSquirrelEvent(event: Lifecycle, installation: WindowsInstallation | null, operations: {
  ready(): Promise<void>; run(executable: string, args: string[]): Promise<void>; repair(): void; cleanup(): void;
}) {
  if (event === 'obsolete') return;
  if (!installation) throw new Error('The Windows installation is incomplete.');
  await operations.run(installation.updater, [event === 'uninstall' ? '--removeShortcut=cc-lime.exe' : '--createShortcut=cc-lime.exe']);
  await operations.ready();
  if (event === 'uninstall') operations.cleanup(); else operations.repair();
}
