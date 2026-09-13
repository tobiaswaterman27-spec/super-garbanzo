#!/usr/bin/env node
/* build.js — inline every script into one self-contained page.
 *
 *   node prototype/character-forge/build.js
 *
 * Produces dist/character-forge.html: the same prototype with no external
 * files, so it runs straight off the filesystem with no server. Re-run it
 * after changing anything under prototype/character-forge/.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Load order matters: each file registers a global the next one reads.
const SOURCES = [
  'render.js', 'parts.js', 'character.js', 'font.js',
  'rig.js', 'dialogue.js', 'world.js', 'app.js'
];

const here = __dirname;
const outDir = path.join(here, '..', '..', 'dist');
const outFile = path.join(outDir, 'character-forge.html');

let html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

const bundle = SOURCES.map(function (name) {
  return '/* ===== ' + name + ' ===== */\n' + fs.readFileSync(path.join(here, name), 'utf8');
}).join('\n');

html = html.replace(/<script src="[^"]+\.js"><\/script>\s*/g, '');
html = html.replace(/\s+$/, '') + '\n\n<script>\n' + bundle + '\n</script>\n';

if (/<script src=/.test(html)) {
  console.error('build failed: an external script tag survived inlining');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);
console.log('wrote ' + path.relative(path.join(here, '..', '..'), outFile) +
  ' (' + Math.round(fs.statSync(outFile).size / 1024) + ' KB)');
