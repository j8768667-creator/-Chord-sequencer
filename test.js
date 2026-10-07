import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loaderPath = path.join(__dirname, 'loader.mjs');
const testPath = path.join(__dirname, 'midiExporter.test.js');

const child = spawn(process.execPath, [
  '--experimental-loader', loaderPath,
  testPath
], { stdio: 'inherit' });

child.on('exit', code => {
  process.exit(code);
});
