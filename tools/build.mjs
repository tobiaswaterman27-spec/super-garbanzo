// Inline <script src="..."> from src into a single HTML page: node tools/build.mjs pages/x.html dist/x.html
import fs from 'fs'; import path from 'path';
const [,, inp, out] = process.argv;
let html = fs.readFileSync(inp, 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const p = path.resolve(path.dirname(inp), src);
  return '<script>\n' + fs.readFileSync(p, 'utf8') + '\n</script>';
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('built', out, (html.length / 1024).toFixed(1) + 'KB');
