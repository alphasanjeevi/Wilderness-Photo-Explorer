import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const tempOutDir = path.join(rootDir, 'dist-webgl-tmp');
const exportDir = path.join(rootDir, 'dist-webgl');
const singleFilePath = path.join(exportDir, 'wilderness-photo-explorer.html');
const siteDir = path.join(exportDir, 'site');
const crazyGamesDir = path.join(exportDir, 'crazygames');
const crazyGamesZipPath = path.join(exportDir, 'wilderness-photo-explorer-crazygames.zip');

console.log('Building production HTML5/WebGL bundle...');
execSync(`npx vite build --base=./ --outDir dist-webgl-tmp`, {
  cwd: rootDir,
  stdio: 'inherit',
});

// 1. Standard CrazyGames HTML5 bundle folder (index.html at bundle root + ./assets/*)
fs.rmSync(crazyGamesDir, { recursive: true, force: true });
fs.mkdirSync(exportDir, { recursive: true });
fs.cpSync(tempOutDir, crazyGamesDir, { recursive: true });

// Keep site/ alias synchronized for generic static hosts (itch.io, Netlify, etc.)
fs.rmSync(siteDir, { recursive: true, force: true });
fs.cpSync(tempOutDir, siteDir, { recursive: true });

// 2. Package ready-to-upload CrazyGames ZIP archive with index.html directly at zip root
if (fs.existsSync(crazyGamesZipPath)) {
  fs.rmSync(crazyGamesZipPath, { force: true });
}
try {
  execSync(
    `python3 -c "import os, zipfile; z=zipfile.ZipFile('${crazyGamesZipPath}', 'w', zipfile.ZIP_DEFLATED); [z.write(os.path.join(r,f), os.path.relpath(os.path.join(r,f), '${crazyGamesDir}')) for r,_,fs in os.walk('${crazyGamesDir}') for f in fs]; z.close()"`,
    { cwd: rootDir, stdio: 'inherit' }
  );
} catch {
  console.warn('Could not package .zip automatically via python3; upload files inside dist-webgl/crazygames/ directly.');
}

// 3. Also produce single-file standalone HTML/WebGL export
let html = fs.readFileSync(path.join(tempOutDir, 'index.html'), 'utf8');

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

fs.writeFileSync(singleFilePath, html, 'utf8');
fs.rmSync(tempOutDir, { recursive: true, force: true });

const bytes = fs.statSync(singleFilePath).size;
console.log(`Exported CrazyGames HTML5 bundle folder (index.html at root): ${crazyGamesDir}`);
if (fs.existsSync(crazyGamesZipPath)) {
  const zipBytes = fs.statSync(crazyGamesZipPath).size;
  console.log(`Exported CrazyGames upload ZIP: ${crazyGamesZipPath} (${(zipBytes / 1024).toFixed(1)} KB)`);
}
console.log(`Exported standalone single-file HTML/WebGL: ${singleFilePath} (${(bytes / 1024).toFixed(1)} KB)`);
