import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
const javaFolder = existsSync('.tools/java')?readdirSync('.tools/java').find(name => name.includes('jre')):null;
const javaHome = process.env.JAVA_HOME??(javaFolder?path.resolve('.tools/java', javaFolder):null);
if (!javaHome) throw new Error('Install Java 21 and set JAVA_HOME, or add the verified portable JRE under .tools/java.');
const child = spawn(process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec', '--only', 'auth,firestore', '--project', 'demo-cc-lime', '--non-interactive', 'node node_modules/vitest/vitest.mjs run --config vitest.cloud.config.ts'], { stdio: 'inherit', env: { ...process.env, JAVA_HOME: javaHome, PATH: `${path.join(javaHome,'bin')}${path.delimiter}${process.env.PATH}`, FIREBASE_CLI_DISABLE_METRICS: '1' } });
child.on('exit', code => process.exit(code ?? 1));
