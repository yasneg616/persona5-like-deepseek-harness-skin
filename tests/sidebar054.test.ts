import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { syncNavLeaves } from '../src/client/leaves.ts'

const css = readFileSync(new URL('../src/client/skin.css', import.meta.url), 'utf8')
const start = css.indexOf('* 0.5.4 sidebar polish.')
const reduce = css.lastIndexOf('@media (prefers-reduced-motion: reduce)')
// The 0.5.4 block ends where the 0.5.5 popups block starts (or at reduced motion).
const next = css.indexOf('/* ===== 0.5.5 popups', start)
const block = css.slice(start, next > start ? next : reduce)

test('brand slots stay occupied but draw no DSH mark or 斩噪 name', () => {
  const overlay = readFileSync(new URL('../src/client/overlay.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(overlay, /斩噪/)
  assert.match(overlay, /export function BrandMark\([^)]*\) \{\s*return <span className="dsh-cc-mark dsh-cc-void" aria-hidden="true" \/>/)
  assert.match(overlay, /export function BrandName\(\) \{\s*return <span className="dsh-cc-name dsh-cc-void" aria-hidden="true" \/>/)
  assert.match(block, /\.dsh-cc-void \{\s*display: none !important;/)
  // The cutout brand moves up into the freed space; the first leaf follows.
  assert.match(block, /\.dsh-cc-architecture \{\s*top: 24px;/)
  assert.match(block, /\[data-cc-leaf\]\[data-cc-i="0"\] \{\s*margin-top: clamp\(108px, 17vh, 162px\);/)
})

test('the account "更多" control and the empty brand button never become paper leaves', () => {
  const dom = new JSDOM(`<div id="frame"><div><div>
      <div class="logo"><button class="brand"><span><span class="dsh-cc-mark dsh-cc-void"></span><span class="dsh-cc-name dsh-cc-void"></span></span></button>
      <button data-sidebar-toggle aria-label="收起侧边栏"></button></div>
      <button>新会话</button>
      <nav><button aria-label="插件">插件</button></nav>
      <div class="foot"><button data-signed-out="true" data-collapsed="false" aria-haspopup="menu" aria-expanded="false"><svg></svg><span>更多</span></button></div>
    </div></div><div></div><div data-shell-overlay></div></div>`)
  syncNavLeaves(dom.window.document)
  const marked = Array.from(dom.window.document.querySelectorAll('[data-cc-leaf]')).map((el) => el.textContent?.trim())
  assert.deepEqual(marked, ['新会话', '插件'])
})

test('0.5.4 CSS: no bottom fade, crisp project rows, account ticket strip, all before reduced motion', () => {
  assert.ok(start > 0 && start < reduce)
  // The host's session-list fade span is removed (not just recolored).
  assert.match(block, /span\[class\$="_fade"\] \{\s*display: none !important;/)
  // Project rows keep the host flex layout instead of the old inline-block tag.
  assert.match(block, /\[data-row-key\^="workspace:"\] \{\s*display: flex !important;[^}]*width: auto !important;/)
  assert.match(block, /\[data-row-key\^="workspace:"\]\[aria-expanded="true"\]/)
  assert.ok(block.includes('[class*="_sectionLabel"]'))
  assert.ok(block.includes('[class*="_sectionHeader"] button'))
  // Account control: only the wide trigger, expanded state, hover lunge, focus ring; menu untouched.
  const account = '[data-signed-out][aria-haspopup="menu"]:not([data-collapsed="true"])'
  assert.ok(block.includes(`${account}::before`))
  assert.ok(block.includes(`${account}:hover`))
  assert.ok(block.includes(`${account}:focus-visible`))
  assert.ok(block.includes('[data-signed-out][aria-haspopup="menu"][aria-expanded="true"]'))
  // The trigger itself stays clickable (only its decorative pseudo-elements ignore the pointer).
  assert.doesNotMatch(block, /\[aria-haspopup="menu"\]:not\(\[data-collapsed="true"\]\) \{[^}]*pointer-events: none/)
  assert.doesNotMatch(block, /role="menu"|_signedOutMenu/)
  // No flashing.
  assert.doesNotMatch(block, /opacity|steps\(/)
  const tail = css.slice(reduce)
  for (const selector of ['[data-signed-out][aria-haspopup="menu"]', '[data-row-key^="workspace:"]', '[class*="_sectionHeader"] button']) {
    assert.ok(tail.includes(selector), selector)
  }
  const morph = readFileSync(new URL('../src/client/morph.ts', import.meta.url), 'utf8')
  assert.ok(morph.includes('[data-signed-out][aria-haspopup="menu"]:not([data-collapsed="true"])'))
  assert.ok(morph.includes('[data-row-key^="workspace:"]'))
})
