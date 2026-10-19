import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

if (process.platform === 'win32') {
  // electron-winstaller 5.4.4's hook interpolates os.arch without calling it.
  // Select its existing vendor files explicitly; never enable arbitrary hooks.
  if (process.arch !== 'x64') throw new Error('The verified Windows installer build currently requires an x64 host.');
  const require = createRequire(import.meta.url);
  const root = path.dirname(require.resolve('electron-winstaller/package.json'));
  for (const extension of ['exe', 'dll']) {
    const source = path.join(root, 'vendor', `7z-x64.${extension}`);
    const target = path.join(root, 'vendor', `7z.${extension}`);
    fs.copyFileSync(source, target);
    if (!fs.readFileSync(source).equals(fs.readFileSync(target))) throw new Error('Installer tool selection did not persist.');
  }
  console.log('Selected and verified the packaged Windows x64 installer tools.');
}
