import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const tempOutDir = path.join(rootDir, 'dist-webgl-tmp');
const exportDir = path.join(rootDir, 'dist-webgl');
const singleFilePath = path.join(exportDir, 'wilderness-photo-explorer.html');

console.log('Building production WebGL bundle...');
execSync(`npx vite build --base=./ --outDir dist-webgl-tmp`, {
  cwd: rootDir,
  stdio: 'inherit',
});

let html = fs.readFileSync(path.join(tempOutDir, 'index.html'), 'utf8');

// Inline CSS stylesheets
html = html.replace(
  /<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (fullMatch, href) => {
    const cleanHref = href.replace(/^\.\//, '').replace(/^\//, '');
    const cssPath = path.join(tempOutDir, cleanHref);
    if (!fs.existsSync(cssPath)) return fullMatch;
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    return `<style>\n${cssContent}\n</style>`;
  }
);

// Inline module JS bundle cleanly (escape closing script tags safely)
const scriptMatches = [
  ...html.matchAll(/<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g),
];

const inlinedScripts = [];
for (const match of scriptMatches) {
  const [fullTag, src] = match;
  const cleanSrc = src.replace(/^\.\//, '').replace(/^\//, '');
  const jsPath = path.join(tempOutDir, cleanSrc);
  if (!fs.existsSync(jsPath)) continue;
  const jsContent = fs.readFileSync(jsPath, 'utf8').replace(/<\/script>/gi, '<\\/script>');
  inlinedScripts.push(jsContent);
  html = html.replace(fullTag, '');
}

if (inlinedScripts.length > 0) {
  const combinedScript = `<script type="module">\n${inlinedScripts.join('\n')}\n</script>`;
  html = html.replace('</body>', () => `${combinedScript}\n  </body>`);
}

fs.mkdirSync(exportDir, { recursive: true });
fs.writeFileSync(singleFilePath, html, 'utf8');

// Also keep standard multi-file static WebGL folder for static hosts (itch.io, Netlify, etc.)
const siteDir = path.join(exportDir, 'site');
fs.rmSync(siteDir, { recursive: true, force: true });
fs.cpSync(tempOutDir, siteDir, { recursive: true });
fs.rmSync(tempOutDir, { recursive: true, force: true });

const bytes = fs.statSync(singleFilePath).size;
console.log(`Exported single-file HTML/WebGL game: ${singleFilePath} (${(bytes / 1024).toFixed(1)} KB)`);
console.log(`Exported static WebGL folder: ${siteDir}`);
