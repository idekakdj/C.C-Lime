import { _electron as electron } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const root = process.cwd();
const executablePath = process.argv[2] ?? path.join(root, 'out/C.C. Lime-win32-x64/cc-lime.exe');
const data = path.join(root, 'test-results/feasibility-data');
await mkdir(data, { recursive: true });
const app = await electron.launch({ executablePath, env: { ...process.env, CC_LIME_DATA_DIR: data }, timeout: 60000 });
try {
  const window = await app.firstWindow(); await window.waitForSelector('h1');
  const result = await window.evaluate(() => window.lime.probe());
  const security = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  await window.screenshot({ path: 'test-results/feasibility.png' });
  await window.getByRole('button', { name: 'Test desktop reminder' }).click();
  console.log(JSON.stringify({ ...result, contextIsolation: security.contextIsolation, sandbox: security.sandbox, nodeIntegration: security.nodeIntegration, executablePath }, null, 2));
  await writeFile('test-results/feasibility.json', JSON.stringify({ ...result, executablePath, testedAt: new Date().toISOString() }, null, 2));
} finally { await app.close(); }
