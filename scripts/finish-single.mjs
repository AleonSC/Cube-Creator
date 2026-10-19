// Copies the single-file build to ./Cube-Creator.html so it can be double-clicked.
import { copyFileSync, rmSync } from 'node:fs';

copyFileSync('release/index.html', 'Cube-Creator.html');
rmSync('release', { recursive: true, force: true });
console.log('Built Cube-Creator.html - double-click it to open Cube Creator in your browser.');
