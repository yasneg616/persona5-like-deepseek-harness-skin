import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { syncCollage } from '../src/client/collage.ts'
import {
  BLOCK_MAX, FLOW_BUDGET, MAX_FLOWS, MODE_ATTR, MODE_KEY, SETTLE_MS,
  blocksOf, clearMode, readMode, sourceText, syncMessageCollage, writeMode,
} from '../src/client/letters.ts'

function dom(html: string) {
  return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document
}

/** Two passes, SETTLE_MS apart: the text has sat still, so it is cut. */
function settle(documentRef: Document, mode: 'plain' | 'collage' = 'collage', at = 0) {
  syncMessageCollage(documentRef, mode, at)
  syncMessageCollage(documentRef, mode, at + SETTLE_MS)
}

const tiles = (node: Element) => Array.from(node.querySelectorAll('.dsh-cc-collage .dsh-cc-han'))

test('mode: plain by default, collage only when chosen, storage failures fall back quietly', () => {
  const store = new Map<string, string>()
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
  assert.equal(readMode(storage), 'plain')
  assert.equal(readMode(null), 'plain')
  writeMode(storage, 'collage')
  assert.equal(store.get(MODE_KEY), 'collage')
  assert.equal(readMode(storage), 'collage')
  store.set(MODE_KEY, 'ransom')
  assert.equal(readMode(storage), 'plain')
  const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
  assert.equal(readMode(broken), 'plain')
  assert.doesNotThrow(() => writeMode(broken, 'collage'))
})

test('plain mode leaves every message untouched', () => {
  const documentRef = dom('<article data-chat-flow-kind="assistant-step"><p>先看到期时刻。</p></article>')
  const before = documentRef.body.innerHTML
  settle(documentRef, 'plain')
  assert.equal(documentRef.body.innerHTML, before)
  assert.equal(documentRef.documentElement.getAttribute(MODE_ATTR), 'plain')
})

test('collage waits for the text to settle, then adds one aria-hidden clone and keeps the host text nodes', () => {
  const documentRef = dom('<article data-chat-flow-kind="user"><p>检查令牌 refresh 失败。</p></article>')
  const p = documentRef.querySelector('p')!
  const hostNode = p.firstChild
  syncMessageCollage(documentRef, 'collage', 0)
  assert.equal(p.querySelector('.dsh-cc-collage'), null, 'not cut while it may still stream')
  syncMessageCollage(documentRef, 'collage', SETTLE_MS - 1)
  assert.equal(p.querySelector('.dsh-cc-collage'), null)
  syncMessageCollage(documentRef, 'collage', SETTLE_MS)
  const clone = p.querySelector('.dsh-cc-collage')!
  assert.equal(clone.getAttribute('aria-hidden'), 'true')
  assert.equal(p.firstChild, hostNode, 'React keeps its own text node')
  assert.equal(hostNode!.nodeValue, '检查令牌 refresh 失败。')
  assert.equal(sourceText(p), '检查令牌 refresh 失败。')
  assert.equal(clone.textContent, '检查令牌 refresh 失败。')
  // A later pass does not rebuild a settled block.
  syncMessageCollage(documentRef, 'collage', SETTLE_MS * 4)
  assert.equal(p.querySelector('.dsh-cc-collage'), clone)
})

test('collage letters wrap: every CJK letter is its own group, Latin words and closing punctuation stay together', () => {
  const documentRef = dom('<article data-chat-flow-kind="assistant-step"><p>统一 UTC，再合并。</p></article>')
  settle(documentRef)
  const groups = Array.from(documentRef.querySelectorAll('.dsh-cc-collage .dsh-cc-word')).map((g) => g.textContent)
  assert.deepEqual(groups, ['统', '一', 'UTC，', '再', '合', '并。'])
  const faces = new Set(tiles(documentRef.body).map((t) => t.getAttribute('data-cc-face')))
  assert.ok(faces.size >= 2, 'mixed faces')
  assert.equal(faces.has('CcBrush'), false)
  const punct = tiles(documentRef.body).filter((t) => t.textContent === '，' || t.textContent === '。')
  assert.ok(punct.every((t) => t.getAttribute('data-cc-han') === '4' && t.hasAttribute('data-cc-punct')))
})

test('a host rewrite shows plain until the new text settles, then is cut again', () => {
  const documentRef = dom('<article data-chat-flow-kind="assistant-step"><p>旧的文字</p></article>')
  const p = documentRef.querySelector('p')!
  settle(documentRef)
  assert.ok(p.querySelector('.dsh-cc-collage'))
  p.firstChild!.nodeValue = '新的文字更长'
  syncMessageCollage(documentRef, 'collage', 2000)
  assert.equal(p.querySelector('.dsh-cc-collage'), null)
  assert.equal(p.hasAttribute('data-cc-collage'), false)
  syncMessageCollage(documentRef, 'collage', 2000 + SETTLE_MS)
  assert.equal(p.querySelector('.dsh-cc-collage')!.textContent, '新的文字更长')
})

test('code, links, lists, tables, quotes and tool cards stay plain', () => {
  const documentRef = dom(`
    <article data-chat-flow-kind="assistant-step">
      <p>运行 <code>npm test</code> 看 <a href="https://example.com">文档</a> <strong>重点</strong></p>
      <ul><li><p>列表里的段落</p></li></ul>
      <table><tr><td><p>表格</p></td></tr></table>
      <blockquote><p>引用</p></blockquote>
      <pre><code>if ready: return</code></pre>
    </article>
    <article data-chat-flow-kind="tool-call"><p>工具卡</p></article>`)
  settle(documentRef)
  const flow = documentRef.querySelector('[data-chat-flow-kind="assistant-step"]')!
  assert.equal(blocksOf(flow).length, 1)
  const clone = documentRef.querySelector('.dsh-cc-collage')!
  assert.equal(clone.querySelector('code.dsh-cc-kept')!.textContent, 'npm test')
  assert.equal(clone.querySelector('a.dsh-cc-kept')!.getAttribute('href'), 'https://example.com')
  assert.equal(clone.querySelector('a.dsh-cc-kept .dsh-cc-han'), null, 'links are not cut')
  assert.ok(clone.querySelector('[data-cc-strong] .dsh-cc-han'))
  for (const selector of ['li p', 'td p', 'blockquote p', 'pre', '[data-chat-flow-kind="tool-call"] p']) {
    assert.equal(documentRef.querySelector(selector)!.querySelector('.dsh-cc-collage'), null, selector)
  }
})

test('cost is capped: long paragraphs, the per-message budget and old messages stay plain', () => {
  const long = '长'.repeat(BLOCK_MAX + 1)
  const chunk = '字'.repeat(200)
  const documentRef = dom(`<article data-chat-flow-kind="assistant-step">
      <p>${long}</p><p>${chunk}</p><p>${chunk}</p><p>${chunk}</p><p>短句</p>
    </article>`)
  settle(documentRef)
  const paragraphs = Array.from(documentRef.querySelectorAll('p'))
  assert.equal(paragraphs[0].querySelector('.dsh-cc-collage'), null, 'over BLOCK_MAX')
  assert.ok(paragraphs[1].querySelector('.dsh-cc-collage'))
  assert.ok(paragraphs[2].querySelector('.dsh-cc-collage'))
  assert.ok(400 <= FLOW_BUDGET && FLOW_BUDGET < 600)
  assert.equal(paragraphs[3].querySelector('.dsh-cc-collage'), null, 'budget spent')
  assert.equal(paragraphs[4].querySelector('.dsh-cc-collage'), null, 'later blocks fall back to plain')
  assert.ok(tiles(documentRef.body).length <= FLOW_BUDGET)

  const many = dom(Array.from({ length: MAX_FLOWS + 3 }, (_, i) => `<article data-chat-flow-kind="user"><p>第${i}条</p></article>`).join(''))
  settle(many)
  const cut = Array.from(many.querySelectorAll('article')).map((a) => a.querySelector('.dsh-cc-collage') !== null)
  assert.deepEqual(cut, [...Array(3).fill(false), ...Array(MAX_FLOWS).fill(true)])
})

test('switching back to plain removes every clone and mark; the welcome headline is cut in either mode', () => {
  const documentRef = dom(`<div data-conversation-scroll><h1 data-cc-hero-title>探索未至之境</h1>
    <article data-chat-flow-kind="assistant-step"><h2>修复建议</h2><p>注入时钟。</p></article></div>`)
  settle(documentRef)
  assert.equal(documentRef.querySelectorAll('.dsh-cc-collage').length, 2)
  settle(documentRef, 'plain', 5000)
  assert.equal(documentRef.querySelectorAll('.dsh-cc-collage, [data-cc-collage], [data-cc-collage-pending]').length, 0)
  assert.equal(documentRef.querySelector('h2')!.textContent, '修复建议')
  syncCollage(documentRef, 0)
  syncCollage(documentRef, 600)
  assert.equal(documentRef.querySelectorAll('[data-cc-hero-title] .dsh-cc-han').length, 6)
  clearMode(documentRef)
  assert.equal(documentRef.documentElement.hasAttribute(MODE_ATTR), false)
})

test('0.5.1 CSS: heavy offline chat faces, readable plain sizes, collage stays selectable once, switch is clickable', () => {
  const css = readFileSync(new URL('../src/client/skin.css', import.meta.url), 'utf8')
  for (const file of ['CcHeavyBold-SC.woff2', 'CcHeavyBlack-SC.woff2', 'BarlowSemiCondensed-SemiBold.woff2', 'BarlowSemiCondensed-ExtraBold.woff2']) {
    assert.ok(css.includes(file), file)
  }
  const chat = css.match(/--dsh-cc-chat: ([^;]+);/)![1]
  assert.match(chat, /^CcLatin, CcHeavy, "Microsoft YaHei UI", "Microsoft YaHei"/)
  assert.doesNotMatch(chat, /CcBrush|CcDisplay|Ma Shan/)
  assert.match(css, /\[data-chat-flow-kind="assistant-step"\] :is\(p, li, td, th, blockquote\),[\s\S]*?font-family: var\(--dsh-cc-chat\);\s*font-weight: 600;\s*font-size: max\(17px/)
  assert.match(css, /\[data-composer-input\] \{\s*font-family: var\(--dsh-cc-chat\) !important;/)
  assert.match(css, /\[data-cc-collage\] \{\s*user-select: none;/)
  assert.match(css, /\.dsh-cc-collage \{[\s\S]*?user-select: text;/)
  const toggle = css.match(/\.dsh-cc-letters \{([\s\S]*?)\}/)![1]
  assert.match(toggle, /pointer-events: auto/)
  assert.ok(css.indexOf('@keyframes dsh-cc-tile-in') < css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
  assert.ok(css.indexOf('@keyframes dsh-cc-letters-flip') < css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
})
