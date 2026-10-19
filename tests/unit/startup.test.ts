import { expect, it } from 'vitest';
import type { LoginItemSettings } from 'electron';
import { STARTUP_NAME, STARTUP_ARGS, startupQuery, startupState } from '../../src/main/startup';

const launcher = 'C:\\Users\\Student Name\\AppData\\Local\\cc_lime\\cc-lime.exe';
const entry = { name: STARTUP_NAME, path: launcher, args: [], scope: 'user' as const, enabled: true };
function settings(items = [entry]): Pick<LoginItemSettings,'openAtLogin'|'wasOpenedAtLogin'|'launchItems'> {
  return { openAtLogin: false, wasOpenedAtLogin: false, launchItems: items };
}
it('reads the named Windows entry even when the legacy AUMID flag is false', () => {
  expect(startupQuery('win32',launcher)).toEqual({ path: `"${launcher}"`, args: ['--background'] });
  expect(startupState('win32',launcher,settings())).toEqual({ registered: true, enabled: true, wasOpenedAtLogin: false });
});
it('distinguishes Windows disablement from missing registration', () => {
  expect(startupState('win32',launcher,settings([{ ...entry, enabled: false }]))).toEqual({ registered: true, enabled: false, wasOpenedAtLogin: false });
  expect(startupState('win32',launcher,settings([]))).toEqual({ registered: false, enabled: false, wasOpenedAtLogin: false });
});
it.each([
  { name: 'foreign app' }, { path: 'C:\\foreign\\cc-lime.exe' },
  { args: ['foreign positional argument'] }, { args: ['--background','--foreign'] },
  { args: ['--foreground'] }, { scope: 'machine' as const }
])('ignores a different registration: %j', difference => {
  expect(startupState('win32',launcher,settings([{...entry,...difference}] as typeof entry[])).registered).toBe(false);
});
it('normalizes Windows path separators and case without altering arguments', () => {
  expect(startupState('win32',launcher,settings([{...entry,path: launcher.toUpperCase().replaceAll('\\','/')}])).enabled).toBe(true);
});
it('retains non-Windows API behavior and unquoted paths', () => {
  expect(startupQuery('darwin','/Applications/C.C. Lime.app')).toEqual({path:'/Applications/C.C. Lime.app',args:['--background']});
  expect(startupState('darwin','/Applications/C.C. Lime.app',{...settings([]),openAtLogin:true,wasOpenedAtLogin:true})).toEqual({registered:true,enabled:true,wasOpenedAtLogin:true});
});
