import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { WINDOWS_IDENTITIES } from '../../src/main/windows-integration';

const executable = process.env.CC_LIME_TEST_EXECUTABLE ?? path.resolve('out/C.C. Lime-win32-x64/cc-lime.exe');
const bundle = path.resolve('test-results/windows-integration.cjs');
const startupBundle = path.resolve('test-results/startup-integration.cjs');
let app: ElectronApplication;
test.skip(process.platform !== 'win32', 'Native Windows shortcut checks');
test.beforeAll(async () => { await Promise.all([
  build({ entryPoints: ['src/main/windows-integration.ts'], outfile: bundle, bundle: true, platform: 'node', format: 'cjs' }),
  build({ entryPoints: ['src/main/startup.ts'], outfile: startupBundle, bundle: true, platform: 'node', format: 'cjs' })
]); });
test.afterEach(async () => { await app?.close(); });
async function launch(profile: string) {
  app = await electron.launch({ executablePath: executable, args: [`--cc-lime-test-profile=${profile}`], timeout: 60000 });
  await (await app.firstWindow()).waitForFunction(() => !!window.lime);
}
test('reads native Windows startup enablement by name and refuses test-profile registration', async () => {
  const base = path.resolve('test-results/startup fixtures', randomUUID());
  await launch(path.join(base,'profile'));
  const result = await app.evaluate(({ app }, { base, startupBundle }) => {
    const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path');
    const nativeRequire = process.getBuiltinModule('module').createRequire(process.execPath);
    const { startupQuery, startupState } = nativeRequire(startupBundle);
    const launcher = path.join(base,'cc-lime.exe'), name = `CC-Lime-Startup-Test-${path.basename(base)}`;
    fs.mkdirSync(base,{recursive:true});fs.writeFileSync(launcher,'synthetic fixture; never executed');
    const query = startupQuery('win32',launcher);
    const before = app.getLoginItemSettings(query);
    if(before.launchItems.length)throw new Error('Fixture startup entry already exists');
    const { execFileSync } = process.getBuiltinModule('child_process');
    const owner = () => ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'].map(key => {
      try { return execFileSync('reg.exe',['query',key,'/v','C.C. Lime'],{windowsHide:true,stdio:['ignore','pipe','ignore']}).toString(); }
      catch(error:any) { if(error.status===1)return null;throw error; }
    });
    const ownerBefore = owner();
    try {
      app.setLoginItemSettings({name,path:launcher,args:['--background'],openAtLogin:true,enabled:true});
      const enabled = app.getLoginItemSettings(query);
      app.setLoginItemSettings({name,path:launcher,args:['--background'],openAtLogin:true,enabled:false});
      const disabled = app.getLoginItemSettings(query);
      return { legacyEnabled:enabled.openAtLogin, enabled:startupState('win32',launcher,enabled,name),disabled:startupState('win32',launcher,disabled,name),ownerUnchanged:JSON.stringify(owner())===JSON.stringify(ownerBefore) };
    } finally {
      app.setLoginItemSettings({name,path:launcher,args:['--background'],openAtLogin:false});
      if(app.getLoginItemSettings(query).launchItems.length)throw new Error('Fixture registration cleanup failed');
      if(JSON.stringify(owner())!==JSON.stringify(ownerBefore))throw new Error('Owner startup entry changed');
    }
  }, {base,startupBundle});
  expect(result).toEqual({legacyEnabled:false,enabled:{registered:true,enabled:true,wasOpenedAtLogin:false},disabled:{registered:true,enabled:false,wasOpenedAtLogin:false},ownerUnchanged:true});
  const page = await app.firstWindow();
  const denied = await page.evaluate(async()=>{
    const before = await window.lime.call<any>('snapshot');
    let error='';try{await window.lime.call('device',{startAtLogin:true});}catch(e){error=(e as Error).message;}
    await window.lime.call('device',{startAtLogin:false});
    const after = await window.lime.call<any>('snapshot');
    return {error,before:before.device.startAtLogin,after:after.device.startAtLogin,startup:after.startup};
  });
  expect(denied.error).toContain('installed app');expect(denied.before).toBe(false);expect(denied.after).toBe(false);
  expect(denied.startup).toEqual({enabled:false,registered:false,wasOpenedAtLogin:false});
});
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
