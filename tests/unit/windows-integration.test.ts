import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import type { ShortcutDetails } from 'electron';
import { WINDOWS_IDENTITIES, squirrelInstallation, squirrelEvent, repairInstalledShortcuts, removeInstalledRootShortcut, handleSquirrelEvent, type ShortcutIO } from '../../src/main/windows-integration';

const win = path.win32, installation = {
  executable: 'C:\\Local\\cc_lime\\app-0.1.4\\cc-lime.exe', directory: 'C:\\Local\\cc_lime\\app-0.1.4',
  launcher: 'C:\\Local\\cc_lime\\cc-lime.exe', updater: 'C:\\Local\\cc_lime\\Update.exe',
};
const paths = { appData: 'C:\\Roaming', desktop: 'C:\\Desktop', profile: 'C:\\Roaming\\C.C. Lime' };
const programs = win.join(paths.appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
const root = win.join(programs, 'C.C. Lime.lnk'), installer = win.join(programs, 'idekakdj', 'C.C. Lime.lnk'), desktop = win.join(paths.desktop, 'C.C. Lime.lnk');
const stale: ShortcutDetails = { target: 'C:\\Old\\cc-lime.exe', cwd: 'C:\\Old\\app-0.1.3', args: '', appUserModelId: WINDOWS_IDENTITIES.installed.id, toastActivatorClsid: '{3B1BBDBE-F93B-5802-9FA5-14A85840BBE3}' };
function fake(entries: Array<[string, ShortcutDetails]> = []) {
  const files = new Map(entries);
  const io: ShortcutIO = {
    exists: file => files.has(file), read: vi.fn(file => { const entry = files.get(file); if (!entry) throw Error('unreadable'); return { ...entry }; }),
    write: vi.fn((file, _operation, details) => { files.set(file, { ...details }); return true; }),
    backup: vi.fn(), mkdir: vi.fn(), remove: vi.fn(file => { files.delete(file); }),
  };
  return { io, files };
}
describe('Windows installation boundary', () => {
  it('requires the installed version directory and both sibling executables', () => {
    const isFile = vi.fn((_file: string) => true);
    expect(squirrelInstallation('win32', true, installation.executable, isFile)).toEqual(installation);
    expect(isFile.mock.calls.map(call => call[0])).toEqual([installation.executable, installation.launcher, installation.updater]);
    expect(squirrelInstallation('win32', true, installation.executable, file => file !== installation.updater)).toBeNull();
    expect(squirrelInstallation('win32', true, 'C:\\Preview\\cc-lime.exe', isFile)).toBeNull();
    expect(squirrelInstallation('win32', true, 'C:\\app-0.1.4\\other.exe', isFile)).toBeNull();
    expect(squirrelInstallation('win32', false, installation.executable, isFile)).toBeNull();
    expect(squirrelInstallation('linux', true, installation.executable, isFile)).toBeNull();
  });
  it('keeps development and test notification registrations separate', () => {
    for (const field of ['id', 'name', 'clsid'] as const) expect(new Set(Object.values(WINDOWS_IDENTITIES).map(identity => identity[field])).size).toBe(3);
  });
});
describe('notification shortcut repair', () => {
  it('creates the required root without recreating a deleted desktop shortcut', () => {
    const { io, files } = fake();
    expect(repairInstalledShortcuts(installation, paths, io)).toBe(1);
    expect([...files.keys()]).toEqual([root]); expect(io.backup).not.toHaveBeenCalled();
    expect(files.get(root)).toMatchObject({ target: installation.launcher, cwd: installation.directory, appUserModelId: WINDOWS_IDENTITIES.installed.id, toastActivatorClsid: WINDOWS_IDENTITIES.installed.clsid });
    expect(repairInstalledShortcuts(installation, paths, io)).toBe(0); expect(io.write).toHaveBeenCalledTimes(1);
  });
  it('aligns all owned shortcuts, backs up before editing and preserves arguments', () => {
    const { io, files } = fake([[root, stale], [installer, stale], [desktop, { ...stale, args: '--background' }]]);
    expect(repairInstalledShortcuts(installation, paths, io)).toBe(3);
    for (const details of files.values()) expect(details).toMatchObject({ target: installation.launcher, cwd: installation.directory, toastActivatorClsid: WINDOWS_IDENTITIES.installed.clsid });
    expect(files.get(desktop)?.args).toBe('--background'); expect(io.backup).toHaveBeenCalledTimes(3);
    expect(vi.mocked(io.backup).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(io.write).mock.invocationCallOrder[0]);
    expect(repairInstalledShortcuts(installation, paths, io)).toBe(0); expect(io.write).toHaveBeenCalledTimes(3);
  });
  it.each([
    { ...stale, appUserModelId: 'some.other.app' }, { ...stale, appUserModelId: undefined }, { ...stale, target: 'C:\\Other\\other.exe' },
  ])('does not overwrite a name collision or partially repair before detecting it', foreign => {
    const { io } = fake([[root, stale], [installer, foreign]]);
    expect(() => repairInstalledShortcuts(installation, paths, io)).toThrow('another application');
    expect(io.write).not.toHaveBeenCalled(); expect(io.backup).not.toHaveBeenCalled();
  });
  it('does not overwrite an unreadable shortcut', () => {
    const { io } = fake([[root, stale]]); vi.mocked(io.read).mockImplementation(() => { throw Error('corrupt shortcut'); });
    expect(() => repairInstalledShortcuts(installation, paths, io)).toThrow('corrupt shortcut'); expect(io.write).not.toHaveBeenCalled();
  });
  it.each(['write', 'readback', 'backup'])('reports %s failure instead of success', mode => {
    const { io } = fake([[root, stale]]);
    if (mode === 'write') vi.mocked(io.write).mockReturnValue(false);
    if (mode === 'readback') vi.mocked(io.write).mockImplementation(() => true);
    if (mode === 'backup') vi.mocked(io.backup).mockImplementation(() => { throw Error('backup denied'); });
    expect(() => repairInstalledShortcuts(installation, paths, io)).toThrow();
    if (mode === 'backup') expect(io.write).not.toHaveBeenCalled();
  });
  it('only removes an owned root shortcut targeting the installation being removed', () => {
    const { io, files } = fake([[root, { ...stale, target: installation.launcher }], [desktop, stale]]);
    removeInstalledRootShortcut(installation, paths, io); expect(files.has(root)).toBe(false); expect(files.has(desktop)).toBe(true);
    for (const details of [stale, { ...stale, target: installation.launcher, appUserModelId: 'another.app' }]) {
      files.set(root, details); removeInstalledRootShortcut(installation, paths, io); expect(files.get(root)).toEqual(details);
    }
  });
});
describe('Squirrel lifecycle', () => {
  function operations() { return { run: vi.fn(async () => {}), ready: vi.fn(async () => {}), repair: vi.fn(), cleanup: vi.fn() }; }
  it('only recognizes exact installer events in the expected argument position', () => {
    expect(squirrelEvent('win32', ['app', '--squirrel-install'])).toBe('install');
    expect(squirrelEvent('win32', ['app', '--squirrel-firstrun'])).toBeNull();
    expect(squirrelEvent('win32', ['app', '--other', '--squirrel-install'])).toBeNull();
    expect(squirrelEvent('linux', ['app', '--squirrel-install'])).toBeNull();
  });
  it.each(['install', 'updated'] as const)('waits for shortcut creation and app readiness before repairing %s', async event => {
    const ops = operations(); await handleSquirrelEvent(event, installation, ops);
    expect(ops.run).toHaveBeenCalledWith(installation.updater, ['--createShortcut=cc-lime.exe']);
    expect(ops.run.mock.invocationCallOrder[0]).toBeLessThan(ops.ready.mock.invocationCallOrder[0]);
    expect(ops.ready.mock.invocationCallOrder[0]).toBeLessThan(ops.repair.mock.invocationCallOrder[0]); expect(ops.cleanup).not.toHaveBeenCalled();
  });
  it('runs uninstall cleanup after shortcut removal without repair', async () => {
    const ops = operations(); await handleSquirrelEvent('uninstall', installation, ops);
    expect(ops.run).toHaveBeenCalledWith(installation.updater, ['--removeShortcut=cc-lime.exe']); expect(ops.cleanup).toHaveBeenCalledOnce(); expect(ops.repair).not.toHaveBeenCalled();
  });
  it('obsolete has no effects and incomplete installations fail', async () => {
    const ops = operations(); await handleSquirrelEvent('obsolete', null, ops); expect(ops.run).not.toHaveBeenCalled(); expect(ops.ready).not.toHaveBeenCalled();
    await expect(handleSquirrelEvent('install', null, ops)).rejects.toThrow('incomplete'); expect(ops.run).not.toHaveBeenCalled();
  });
  it('propagates updater errors without subsequent effects', async () => {
    const ops = operations(); ops.run.mockRejectedValue(Error('updater failed'));
    await expect(handleSquirrelEvent('updated', installation, ops)).rejects.toThrow('updater failed');
    expect(ops.ready).not.toHaveBeenCalled(); expect(ops.repair).not.toHaveBeenCalled();
  });
});
