import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const doc = readFileSync(new URL('../docs/COMPATIBILITY.md', import.meta.url), 'utf8')
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

test('docs state that a page reload does not unload this client', () => {
  assert.match(doc, /restart-required/)
  assert.match(doc, /no-hmr/)
  assert.match(doc, /page reload still had/)
  assert.match(doc, /Restarting the `dsh` process cleared/)
  assert.match(doc, /dsh plugin --profile calling-card remove dsh-calling-card-skin/)
  assert.match(readme, /A page reload does not remove the style/)
  assert.doesNotMatch(doc, /Reloading then removes/)
  assert.doesNotMatch(readme, /until the next load, then they are gone/)
})
