// Build: node build.mjs  (add --watch for dev)
import * as esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

const out = 'dist'
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
fs.cpSync('public', out, { recursive: true })
fs.copyFileSync('index.html', path.join(out, 'index.html'))

// Bundle hls.js / mpegts.js locally when installed (offline-capable apps); otherwise the app loads them from CDN.
const vendor = [
  ['node_modules/hls.js/dist/hls.min.js', 'hls.min.js'],
  ['node_modules/mpegts.js/dist/mpegts.js', 'mpegts.js'],
]
for (const [src, name] of vendor)
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.join(out, 'vendor'), { recursive: true })
    fs.copyFileSync(src, path.join(out, 'vendor', name))
  }

const opts = {
  entryPoints: { app: 'src/main.tsx' },
  bundle: true,
  minify: !process.argv.includes('--watch'),
  sourcemap: process.argv.includes('--watch'),
  target: ['es2017'], // covers Tizen 5+, webOS 5+, Fire TV, old Android TV
  outdir: out,
  jsx: 'automatic',
  external: ['./bg/*'], // background images are copied from public/
  loader: { '.svg': 'dataurl', '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.SITE_URL': JSON.stringify(process.env.SITE_URL || '') },
  nodePaths: process.env.NODE_PATH ? process.env.NODE_PATH.split(':') : [],
  logLevel: 'info',
}
if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(opts)
  await ctx.watch()
  const { port } = await ctx.serve({ servedir: out, port: 5173 })
  console.log(`Dev server → http://localhost:${port}`)
} else await esbuild.build(opts)
