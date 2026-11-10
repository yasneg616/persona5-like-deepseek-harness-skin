import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { ENTER, ROW_BURST_CAP, STAGGER, createEntryTracker } from '../src/client/motion.ts'
import { createCaption, resolveSection } from '../src/client/title.ts'

function page(reduce = false) {
  const dom = new JSDOM(`<div id="side">
      <button data-cc-leaf>New Session</button>
      <button data-cc-leaf aria-current="page">Plugins</button>
      <div data-row-key="workspace:a">项目</div>
      <div data-row-key="session:1" aria-selected="true">会话一</div>
    </div>
    <div id="scroll">
      <article data-chat-flow-kind="user"><p>旧的提问</p></article>
      <article data-chat-flow-kind="assistant-step"><p>旧的回复</p></article>
    </div>`, { pretendToBeVisual: true })
  const { window } = dom
  window.matchMedia = ((query: string) => ({ matches: reduce && query.includes('reduce'), media: query })) as unknown as typeof window.matchMedia
  return window
}

function flow(doc: Document, kind: string) {
  const node = doc.createElement('article')
  node.setAttribute('data-chat-flow-kind', kind)
  node.textContent = '新的'
  doc.getElementById('scroll')!.append(node)
  return node
}

test('first paint slams leaves and rows in with a stagger, never the existing transcript', () => {
  const win = page()
  const doc = win.document
  const tracker = createEntryTracker(doc, win as unknown as Window)
  tracker.sync({ flows: false, now: 0 })
  const leaves = Array.from(doc.querySelectorAll('[data-cc-leaf]'))
  assert.deepEqual(leaves.map((leaf) => leaf.getAttribute(ENTER)), ['leaf', 'leaf'])
  assert.deepEqual(leaves.map((leaf) => (leaf as HTMLElement).style.getPropertyValue(STAGGER)), ['0', '1'])
  assert.deepEqual(Array.from(doc.querySelectorAll('[data-row-key]')).map((row) => row.getAttribute(ENTER)), ['row', 'row'])
  assert.equal(doc.querySelector(`[data-chat-flow-kind][${ENTER}]`), null)
  // A flow first seen while flows were off stays still later too.
  tracker.sync({ flows: true, now: 10 })
  assert.equal(doc.querySelector(`[data-chat-flow-kind][${ENTER}]`), null)
  tracker.dispose()
})

test('new papers alternate diagonals and are tagged once', () => {
  const win = page()
  const doc = win.document
  const tracker = createEntryTracker(doc, win as unknown as Window)
  tracker.sync({ flows: false, now: 0 })
  const a = flow(doc, 'user')
  const b = flow(doc, 'assistant-step')
  assert.equal(tracker.sync({ flows: true, now: 100 }), 2)
  assert.equal(a.getAttribute(ENTER), 'l')
  assert.equal(b.getAttribute(ENTER), 'r')
  const c = flow(doc, 'tool-call')
  tracker.sync({ flows: true, now: 200 })
  assert.equal(c.getAttribute(ENTER), 'l')
  // Seen nodes are not tagged again, and the leaves are not replayed without a phase change.
  a.removeAttribute(ENTER)
  assert.equal(tracker.sync({ flows: true, now: 300 }), 0)
  assert.equal(a.hasAttribute(ENTER), false)
  tracker.dispose()
})

test('the tag comes off at animationend, by timeout, and on dispose', () => {
  const win = page()
  const doc = win.document
  const tracker = createEntryTracker(doc, win as unknown as Window)
  tracker.sync({ flows: false, now: 0 })
  const leaf = doc.querySelector('[data-cc-leaf]') as HTMLElement
  const other = new win.Event('animationend', { bubbles: true }) as Event & { animationName?: string }
  Object.defineProperty(other, 'animationName', { value: 'dsh-cc-idle-tilt' })
  leaf.dispatchEvent(other)
  assert.equal(leaf.getAttribute(ENTER), 'leaf', 'an idle loop ending does not untag')
  const end = new win.Event('animationend', { bubbles: true })
  Object.defineProperty(end, 'animationName', { value: 'dsh-cc-in-slam' })
  leaf.dispatchEvent(end)
  assert.equal(leaf.hasAttribute(ENTER), false)
  assert.equal(leaf.style.getPropertyValue(STAGGER), '')
  const node = flow(doc, 'user')
  tracker.sync({ flows: true, now: 1_000 })
  assert.equal(node.getAttribute(ENTER), 'l')
  tracker.sync({ flows: true, now: 1_000 + 1_500 })
  assert.equal(node.hasAttribute(ENTER), false, 'stale tags are swept')
  flow(doc, 'assistant-step')
  tracker.sync({ flows: true, now: 3_000 })
  tracker.sync({ flows: false, replayLeaves: true, now: 3_010 })
  assert.ok(doc.querySelectorAll(`[${ENTER}]`).length >= 3)
  tracker.dispose()
  assert.equal(doc.querySelector(`[${ENTER}]`), null)
})

test('a long session list only animates its first rows', () => {
  const win = page()
  const doc = win.document
  for (let i = 0; i < 40; i += 1) {
    const row = doc.createElement('div')
    row.setAttribute('data-row-key', `session:x${i}`)
    doc.getElementById('side')!.append(row)
  }
  const tracker = createEntryTracker(doc, win as unknown as Window)
  tracker.sync({ flows: false, now: 0 })
  assert.equal(doc.querySelectorAll(`[data-row-key][${ENTER}]`).length, ROW_BURST_CAP)
  tracker.dispose()
})

test('reduced motion tags nothing and later passes stay still', () => {
  const win = page(true)
  const doc = win.document
  const tracker = createEntryTracker(doc, win as unknown as Window)
  assert.equal(tracker.sync({ flows: false, now: 0 }), 0)
  flow(doc, 'user')
  assert.equal(tracker.sync({ flows: true, replayLeaves: true, now: 10 }), 0)
  assert.equal(doc.querySelector(`[${ENTER}]`), null)
  tracker.dispose()
})

test('caption slams on change but not on first fill', () => {
  const doc = new JSDOM('<div></div>').window.document
  const caption = createCaption(doc)
  caption.update(resolveSection({ panelLabel: null, headerLabel: '会话', sessionLabel: null }))
  assert.equal(caption.root.classList.contains('is-slam'), false)
  caption.update(resolveSection({ panelLabel: null, headerLabel: '会话', sessionLabel: null }))
  assert.equal(caption.root.classList.contains('is-slam'), false)
  caption.update(resolveSection({ panelLabel: 'Plugins', headerLabel: null, sessionLabel: null }))
  assert.equal(caption.root.classList.contains('is-slam'), true)
})

test('motion CSS: entries keyed on the tag, transform-only, all off under reduced motion', () => {
  const css = readFileSync(new URL('../src/client/skin.css', import.meta.url), 'utf8')
  for (const name of ['dsh-cc-in-slam', 'dsh-cc-in-row', 'dsh-cc-in-fly-l', 'dsh-cc-in-fly-r', 'dsh-cc-in-stamp']) {
    assert.match(css, new RegExp(`@keyframes ${name}`))
  }
  assert.match(css, /\[data-chat-flow-kind\]\[data-cc-enter="l"\]/)
  assert.doesNotMatch(css, /\[data-chat-flow-kind[^\]]*\]\s*(?:p|li|pre|code)[^{]*\{[^}]*animation/)
  const keyframes = css.match(/@keyframes dsh-cc-[a-z-]+ \{[\s\S]*?\n\}/g) ?? []
  for (const block of keyframes) {
    assert.doesNotMatch(block, /\b(?:width|height|top|left|margin|padding|font-size)\s*:/, block.slice(0, 40))
  }
  const reduce = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduce, /animation:\s*none !important/)
  assert.match(reduce, /transition:\s*none !important/)
  assert.match(reduce, /translate:\s*none !important/)
})
