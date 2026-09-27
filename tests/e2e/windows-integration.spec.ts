import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { WINDOWS_IDENTITIES } from '../../src/main/windows-integration';

const executable = process.env.CC_LIME_TEST_EXECUTABLE ?? path.resolve('out/C.C. Lime-win32-x64/cc-lime.exe');
const bundle = path.resolve('test-results/windows-integration.cjs');
let app: ElectronApplication;
test.skip(process.platform !== 'win32', 'Native Windows shortcut checks');
test.beforeAll(async () => { await build({ entryPoints: ['src/main/windows-integration.ts'], outfile: bundle, bundle: true, platform: 'node', format: 'cjs' }); });
test.afterEach(async () => { await app?.close(); });
async function launch(profile: string) {
  app = await electron.launch({ executablePath: executable, args: [`--cc-lime-test-profile=${profile}`], timeout: 60000 });
  await (await app.firstWindow()).waitForFunction(() => !!window.lime);
}
test('keeps test notification identity stable without rewriting installed shortcuts', async () => {
  const profile = path.resolve('test-results/profiles', randomUUID());
  const programs = path.join(process.env.APPDATA!, 'Microsoft/Windows/Start Menu/Programs');
  const files = ['C.C. Lime.lnk', 'idekakdj/C.C. Lime.lnk'].map(file => path.join(programs, file));
  const before = await Promise.all(files.map(file => fs.readFile(file).catch(error => { if (error.code === 'ENOENT') return null; throw error; })));
  for (let attempt = 0; attempt < 2; attempt++) {
    await launch(profile);
    // Exercise the dispatch path too: isolated test runs must not initialize Windows' presenter.
    await (await app.firstWindow()).evaluate(() => window.lime.call('testNotification'));
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(await app.evaluate(({ app }) => ({ name: app.getName(), clsid: app.toastActivatorCLSID, profile: app.getPath('userData') })))
      .toEqual({ name: WINDOWS_IDENTITIES.test.name, clsid: WINDOWS_IDENTITIES.test.clsid, profile });
    await app.close();
  }
  const after = await Promise.all(files.map(file => fs.readFile(file).catch(error => { if (error.code === 'ENOENT') return null; throw error; })));
  expect(after).toEqual(before);
});
test('repairs real Windows shortcut files through fresh install, stale upgrade and owned cleanup', async () => {
  const base = path.resolve('test-results/shortcut-fixtures', randomUUID());
  await launch(path.join(base, 'profile'));
  const result = await app.evaluate(({ shell }, { base, bundle }) => {
    const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path');
    const nativeRequire = process.getBuiltinModule('module').createRequire(process.execPath);
    const { squirrelInstallation, repairInstalledShortcuts, removeInstalledRootShortcut, shortcutIO, WINDOWS_IDENTITIES } = nativeRequire(bundle);
    const directory = path.join(base, 'installed', 'app-0.1.4'), launcher = path.join(base, 'installed', 'cc-lime.exe');
    fs.mkdirSync(directory, { recursive: true });
    for (const file of [launcher, path.join(directory, 'cc-lime.exe'), path.join(base, 'installed', 'Update.exe')]) fs.writeFileSync(file, 'synthetic executable fixture');
    const installed = squirrelInstallation('win32', true, path.join(directory, 'cc-lime.exe'), (file: string) => fs.statSync(file).isFile());
    const locations = { appData: path.join(base, 'roaming'), desktop: path.join(base, 'desktop'), profile: path.join(base, 'profile') };
    const programs = path.join(locations.appData, 'Microsoft/Windows/Start Menu/Programs');
    const root = path.join(programs, 'C.C. Lime.lnk'), squirrel = path.join(programs, 'idekakdj/C.C. Lime.lnk'), desktop = path.join(locations.desktop, 'C.C. Lime.lnk');
    const io = shortcutIO(shell);
    const fresh = repairInstalledShortcuts(installed, locations, io), missingDesktop = !fs.existsSync(desktop);
    fs.mkdirSync(path.dirname(squirrel), { recursive: true }); fs.mkdirSync(locations.desktop, { recursive: true });
    const stale = { ...shell.readShortcutLink(root), cwd: path.join(base, 'old-version'), toastActivatorClsid: '{3B1BBDBE-F93B-5802-9FA5-14A85840BBE3}' };
    for (const file of [root, squirrel, desktop]) {
      if (!shell.writeShortcutLink(file, 'create', stale)) throw Error('Fixture shortcut creation failed');
    }
    const upgraded = repairInstalledShortcuts(installed, locations, io);
    const details = [root, squirrel, desktop].map(file => shell.readShortcutLink(file));
    const unchanged = repairInstalledShortcuts(installed, locations, io);
    const backups = ['root', 'installer', 'desktop'].map(key => shell.readShortcutLink(path.join(locations.profile, 'shortcut-backups', `${key}-before-repair.lnk`)).toastActivatorClsid);
    removeInstalledRootShortcut(installed, locations, io);
    const removed = !fs.existsSync(root), otherFilesPreserved = fs.existsSync(squirrel) && fs.existsSync(desktop);
    shell.writeShortcutLink(root, 'create', { ...stale, appUserModelId: 'foreign.app' });
    removeInstalledRootShortcut(installed, locations, io);
    let refused = false; try { repairInstalledShortcuts(installed, locations, io); } catch { refused = true; }
    return { fresh, missingDesktop, upgraded, unchanged, backups, removed, otherFilesPreserved, refused, foreignPreserved: shell.readShortcutLink(root).appUserModelId === 'foreign.app', aligned: details.every((d: Electron.ShortcutDetails) => d.target === launcher && d.cwd === directory && d.appUserModelId === WINDOWS_IDENTITIES.installed.id && d.toastActivatorClsid === WINDOWS_IDENTITIES.installed.clsid) };
  }, { base, bundle });
  expect(result).toEqual({ fresh: 1, missingDesktop: true, upgraded: 3, unchanged: 0, backups: Array(3).fill('{3B1BBDBE-F93B-5802-9FA5-14A85840BBE3}'), removed: true, otherFilesPreserved: true, refused: true, foreignPreserved: true, aligned: true });
});
