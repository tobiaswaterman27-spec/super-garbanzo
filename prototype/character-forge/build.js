#!/usr/bin/env node
/* build.js — inline every script into one self-contained page.
 *
 *   node prototype/character-forge/build.js
 *
 * Produces dist/character-forge.html: the same prototype with no external
 * files, so it runs straight off the filesystem with no server.
 *
 * The source list is read out of index.html rather than hardcoded here. It was
 * hardcoded once, and when geometry.js was added the build silently dropped it
 * — it stripped every script tag and re-inlined only the ones on the list,
 * shipping a page whose characters could not build at all.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const here = __dirname;
const outDir = path.join(here, '..', '..', 'dist');
const outFile = path.join(outDir, 'character-forge.html');

let html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

// Load order matters: each file registers a global the next one reads, and
// index.html already lists them in that order.
const sources = [];
const tag = /<script src="([^"]+\.js)"><\/script>/g;
let match;
while ((match = tag.exec(html)) !== null) sources.push(match[1]);

if (!sources.length) {
  console.error('build failed: no script tags found in index.html');
  process.exit(1);
}

const missing = sources.filter(function (name) {
  return !fs.existsSync(path.join(here, name));
});
if (missing.length) {
  console.error('build failed: index.html references missing files: ' + missing.join(', '));
  process.exit(1);
}

const bundle = sources.map(function (name) {
  return '/* ===== ' + name + ' ===== */\n' + fs.readFileSync(path.join(here, name), 'utf8');
}).join('\n');

html = html.replace(tag, '');
html = html.replace(/\s+$/, '') + '\n\n<script>\n' + bundle + '\n</script>\n';

if (/<script src=/.test(html)) {
  console.error('build failed: an external script tag survived inlining');
  process.exit(1);
}

// Each module ends by assigning its global; if one is absent the page will
// load and then quietly render nothing, which is exactly what happened before.
const EXPECTED_GLOBALS = ['Geo', 'Render', 'Parts', 'CharacterModel', 'Text', 'Rig',
  'HorseModel', 'Vehicle', 'Combat', 'Items', 'Dialogue', 'World'];
const absent = EXPECTED_GLOBALS.filter(function (name) {
  return html.indexOf('global.' + name + ' = {') === -1 &&
         html.indexOf('global.' + name + ' =') === -1;
});
if (absent.length) {
  console.error('build failed: bundle defines no ' + absent.join(', '));
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);
console.log('wrote ' + path.relative(path.join(here, '..', '..'), outFile) +
  ' (' + Math.round(fs.statSync(outFile).size / 1024) + ' KB)' +
  ' from ' + sources.length + ' scripts: ' + sources.join(', '));
