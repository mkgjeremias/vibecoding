// Construit une version autonome en un seul fichier HTML (CSS et JS intégrés),
// destinée à une publication en page privée. Usage : npm run build:artifact
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist-artifact';
execSync(`npx vite build --base ./ --outDir ${out} --emptyOutDir`, {
  stdio: 'inherit',
  env: { ...process.env, VITE_ARTIFACT: '1' },
});
const assets = join(out, 'assets');
const files = readdirSync(assets);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');

const page = `<title>Tournées commerciales</title>
<style>
html, body { height: 100%; }
${css}
</style>
<div id="root"></div>
<script type="module">
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
writeFileSync(join(out, 'tournees-commerciales.html'), page);
console.log(`Page autonome : ${join(out, 'tournees-commerciales.html')} (${Math.round(page.length / 1024)} Ko)`);
