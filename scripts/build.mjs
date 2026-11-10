import * as esbuild from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const cssResult = await esbuild.build({
  entryPoints: ['src/client/skin.css'],
  bundle: true,
  write: false,
  loader: {
    '.ttf': 'dataurl',
    '.woff2': 'dataurl',
    '.svg': 'dataurl',
  },
  legalComments: 'none',
})

const css = cssResult.outputFiles[0].text
await mkdir('lib', { recursive: true })
await writeFile('lib/skin.css', css)

const client = await esbuild.build({
  entryPoints: ['src/client/index.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  write: false,
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  plugins: [{
    name: 'skin-css-text',
    setup(build) {
      build.onResolve({ filter: /^skin\.css$/ }, () => ({ path: 'skin.css', namespace: 'skin-text' }))
      build.onLoad({ filter: /.*/, namespace: 'skin-text' }, () => ({
        contents: `export default ${JSON.stringify(css)}`,
        loader: 'js',
      }))
    },
  }],
})

const source = client.outputFiles[0].text
const wrapped = `window.__ModuleLoader__.load({
  id: "dsh-calling-card-skin",
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;
    ${source}
    return module.exports;
  }
});
`
await writeFile('lib/client.js', wrapped)

await esbuild.build({
  entryPoints: ['src/client/fixture-boot.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  outfile: 'lib/fixture-boot.js',
})

await esbuild.build({
  entryPoints: ['src/host/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: 'lib/index.js',
})

const hostTypes = `export const name: string
export function apply(): void
`
const clientTypes = `export const name: string
export const inject: readonly string[]
export function apply(ctx: unknown): void
`
await writeFile('lib/index.d.ts', hostTypes)
await mkdir(dirname('lib/client.d.ts'), { recursive: true })
await writeFile('lib/client.d.ts', clientTypes)

const built = await readFile('lib/client.js', 'utf8')
if (!built.includes('window.__ModuleLoader__.load')) throw new Error('client factory wrapper missing')
if (!built.includes('dsh-calling-card-skin/skin.css')) throw new Error('style id missing from client bundle')
if (!built.includes('overrideTokens')) throw new Error('theme override missing from client bundle')
console.log(`built lib/client.js (${built.length} bytes) and lib/index.js`)
