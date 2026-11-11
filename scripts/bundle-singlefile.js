import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const htmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.error('dist/index.html not found. Run vite build first.');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf-8');

// Inline CSS
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (match, href) => {
  const cssPath = path.join(distDir, href);
  if (fs.existsSync(cssPath)) {
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    return '<style>\n' + cssContent + '\n</style>';
  }
  return match;
});

// Remove modulepreload links that cause warnings on file:// protocol
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');

// Inline JS into plain <script> (allows opening locally via file:// without CORS error)
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (match, src) => {
  const jsPath = path.join(distDir, src);
  if (fs.existsSync(jsPath)) {
    const jsContent = fs.readFileSync(jsPath, 'utf-8');
    return '<script>\n' + jsContent + '\n</script>';
  }
  return match;
});

// Save to dist/singlefile.html and public/standalone_raitai_engineering.html
fs.writeFileSync(path.join(distDir, 'singlefile.html'), html, 'utf-8');

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.writeFileSync(path.join(publicDir, 'standalone_raitai_engineering.html'), html, 'utf-8');

console.log('Single-file HTML generated successfully in dist/ and public/ !');
