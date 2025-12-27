const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'src/app/functions/source');
const outDir = path.join(__dirname, 'src/app/functions');

// Get all .js files in sourceDir that are NOT in a subdirectory (like utils)
// We only want to bundle the "entry points" (the actual functions).
const entryPoints = fs.readdirSync(sourceDir)
    .filter(file => file.endsWith('.js') && fs.statSync(path.join(sourceDir, file)).isFile())
    .map(file => path.join(sourceDir, file));

console.log('Building functions:', entryPoints);

esbuild.build({
    entryPoints: entryPoints,
    bundle: true,
    platform: 'node',
    target: 'node18',
    outdir: outDir,
    format: 'cjs',
    sourcemap: false, // Optional: save space
    // Externalize HubSpot specifics? No, standard node modules.
    // define: { 'process.env.NODE_ENV': '"production"' }
}).then(() => {
    console.log('Build complete.');
}).catch(() => process.exit(1));
