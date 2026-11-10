import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { MORPH, MORPH_CAP, MORPH_FIT, MORPH_LAYER, MORPH_POS, MORPH_SEED, createMorphTracker } from '../src/client/morph.ts'

function page(hover = true) {
  const dom = new JSDOM(`<div id="side">
      <button data-cc-leaf id="new">New Session</button>
      <button data-cc-leaf aria-current="page" id="plugins">Plugins</button>
      <div data-row-key="session:1" aria-selected="true" id="s1">会话一</div>
      <div data-row-key="session:2" aria-selected="false" id="s2">会话二</div>
    </div>
    <div class="dsh-cc-caption"><b class="dsh-cc-caption-no">02</b><span class="dsh-cc-caption-body">PLUGINS</span></div>
    <form><div data-composer-card id="card" style="position: relative"><textarea id="input"></textarea><button id="send">发送</button></div></form>`, { pretendToBeVisual: true })
  const { window } = dom
  window.matchMedia = ((query: string) => ({ matches: hover && query.includes('hover'), media: query })) as unknown as typeof window.matchMedia
  return window
}

const layerOf = (node: Element) => Array.from(node.children).filter((child) => child.classList.contains(MORPH_LAYER))

test('selected leaf, selected row and the caption morph; the rest stay static', () => {
  const win = page()
  const doc = win.document
  const tracker = createMorphTracker(doc, win as unknown as Window)
  assert.equal(tracker.sync(), 4)
  const plugins = doc.getElementById('plugins')!
  assert.equal(plugins.getAttribute(MORPH), 'leaf')
  assert.equal(doc.getElementById('s1')!.getAttribute(MORPH), 'row')
  assert.equal(doc.querySelector('.dsh-cc-caption-no')!.getAttribute(MORPH), 'cap-no')
  assert.equal(doc.querySelector('.dsh-cc-caption-body')!.getAttribute(MORPH), 'cap-body')
  for (const id of ['new', 's2', 'card', 'send']) assert.equal(doc.getElementById(id)!.hasAttribute(MORPH), false, id)
  assert.equal(doc.querySelectorAll(`.${MORPH_LAYER}`).length, 4)
  // One plain plate, last child, hidden from assistive tech, no children, no text.
  const [layer] = layerOf(plugins)
  assert.equal(plugins.lastElementChild, layer)
  assert.equal(layer.getAttribute('aria-hidden'), 'true')
  assert.equal(layer.children.length, 0)
  assert.equal(plugins.textContent, 'Plugins')
  // Idempotent: a second pass changes nothing.
  tracker.sync()
  assert.equal(layerOf(plugins).length, 1)
  tracker.dispose()
})

test('a new selection moves the outline and fully reverts the old box', () => {
  const win = page()
  const doc = win.document
  const tracker = createMorphTracker(doc, win as unknown as Window)
  tracker.sync()
  const plugins = doc.getElementById('plugins')!
  const fresh = doc.getElementById('new')!
  plugins.removeAttribute('aria-current')
  fresh.setAttribute('aria-current', 'page')
  tracker.sync()
  assert.equal(fresh.getAttribute(MORPH), 'leaf')
  for (const name of [MORPH, MORPH_POS, MORPH_FIT]) assert.equal(plugins.hasAttribute(name), false, name)
  assert.equal(plugins.style.getPropertyValue(MORPH_SEED), '')
  assert.equal(layerOf(plugins).length, 0)
  assert.equal(plugins.outerHTML, '<button data-cc-leaf="" id="plugins" style="">Plugins</button>')
  tracker.dispose()
})

test('focusing the composer morphs its card; blur reverts it', () => {
  const win = page()
  const doc = win.document
  const tracker = createMorphTracker(doc, win as unknown as Window)
  tracker.sync()
  const card = doc.getElementById('card')!
  doc.getElementById('input')!.focus()
  assert.equal(card.getAttribute(MORPH), 'composer')
  // Already positioned, so the skin leaves its position alone.
  assert.equal(card.hasAttribute(MORPH_POS), false)
  ;(doc.getElementById('input') as HTMLTextAreaElement).blur()
  assert.equal(card.hasAttribute(MORPH), false)
  assert.equal(layerOf(card).length, 0)
  tracker.dispose()
})

test('hover morphs a box only while the pointer is on it, and only with a real hover pointer', () => {
  const win = page()
  const doc = win.document
  const tracker = createMorphTracker(doc, win as unknown as Window)
  tracker.sync()
  const row = doc.getElementById('s2')!
  row.dispatchEvent(new win.Event('pointerover', { bubbles: true }))
  assert.equal(row.getAttribute(MORPH), 'row')
  doc.getElementById('send')!.dispatchEvent(new win.Event('pointerover', { bubbles: true }))
  assert.equal(row.hasAttribute(MORPH), false)
  assert.equal(doc.getElementById('send')!.getAttribute(MORPH), 'button')
  doc.getElementById('send')!.dispatchEvent(new win.Event('pointerout', { bubbles: true }))
  assert.equal(doc.getElementById('send')!.hasAttribute(MORPH), false)
  tracker.dispose()

  const touch = page(false)
  const touchTracker = createMorphTracker(touch.document, touch as unknown as Window)
  touch.document.getElementById('s2')!.dispatchEvent(new touch.Event('pointerover', { bubbles: true }))
  assert.equal(touch.document.getElementById('s2')!.hasAttribute(MORPH), false)
  touchTracker.dispose()
})

test('static hosts get anchored, clipping hosts get the inside fit, and a re-render re-arms', () => {
  const win = page()
  const doc = win.document
  const s1 = doc.getElementById('s1')!
  s1.style.overflow = 'hidden'
  const tracker = createMorphTracker(doc, win as unknown as Window)
  tracker.sync()
  assert.equal(s1.getAttribute(MORPH_POS), 'rel')
  assert.equal(s1.getAttribute(MORPH_FIT), 'in')
  // The host replaced its children (React text update): the next pass puts the layer back.
  s1.textContent = '会话一（改名）'
  assert.equal(layerOf(s1).length, 0)
  tracker.sync()
  assert.equal(layerOf(s1).length, 1)
  assert.equal(s1.textContent, '会话一（改名）')
  tracker.dispose()
})

test('only a handful morph at once, and dispose strips everything', () => {
  const win = page()
  const doc = win.document
  for (let i = 0; i < 20; i += 1) {
    const row = doc.createElement('div')
    row.setAttribute('data-row-key', `session:x${i}`)
    row.setAttribute('aria-selected', 'true')
    doc.getElementById('side')!.append(row)
  }
  const tracker = createMorphTracker(doc, win as unknown as Window)
  assert.equal(tracker.sync(), MORPH_CAP)
  assert.equal(doc.querySelectorAll(`[${MORPH}]`).length, MORPH_CAP)
  tracker.dispose()
  assert.equal(doc.querySelectorAll(`[${MORPH}], [${MORPH_POS}], [${MORPH_FIT}], .${MORPH_LAYER}`).length, 0)
  // Listeners are gone too.
  doc.getElementById('s2')!.dispatchEvent(new win.Event('pointerover', { bubbles: true }))
  assert.equal(doc.querySelectorAll(`[${MORPH}]`).length, 0)
})

test('plate CSS: one red quad, four corners drifting smoothly out of step, inverse text, no flashing', () => {
  const css = readFileSync(new URL('../src/client/skin.css', import.meta.url), 'utf8')
  const start = css.indexOf('/* Selected plate (0.4.7).')
  const end = css.lastIndexOf('@media (prefers-reduced-motion: reduce)')
  assert.ok(start > 0 && end > start)
  const block = css.slice(start, end)
  // The 0.4.6 stepped multi-layer outline is gone.
  assert.doesNotMatch(css, /dsh-cc-morph-(plate|under|line|chip)/)
  assert.doesNotMatch(block, /steps\(|opacity/)
  // Each corner is its own registered length, animated on its own period with easing.
  for (const q of [1, 2, 3, 4]) {
    assert.match(block, new RegExp(`@property --cc-q${q}x \\{ syntax: "<length>"`))
    assert.match(block, new RegExp(`@keyframes dsh-cc-q${q} \\{`))
  }
  const periods = Array.from(block.matchAll(/dsh-cc-q\d ([\d.]+)s ease-in-out infinite alternate/g)).map((m) => Number(m[1]))
  assert.equal(periods.length, 4)
  assert.equal(new Set(periods).size, 4, 'corners are desynced')
  for (const period of periods) assert.ok(period >= 1.2 && period <= 2, `period ${period}`)
  // Keyframes only move corners: no transforms, no color or opacity changes.
  for (const frame of block.matchAll(/@keyframes dsh-cc-q\d \{([\s\S]*?)\n\}/g)) {
    assert.doesNotMatch(frame[1], /transform|opacity|color|background|clip-path/)
  }
  const plate = block.match(/\.dsh-cc-morph \{([\s\S]*?)\n\}/)![1]
  assert.match(plate, /background: var\(--dsh-cc-red\)/)
  assert.match(plate, /pointer-events: none/)
  assert.match(plate, /z-index: -1/)
  // Host keeps its text unclipped and inverts it.
  assert.match(block, /\[data-cc-morph\] \{[\s\S]*?clip-path: none !important/)
  assert.match(block, /color: #fff !important/)
  // Composer keeps its paper; the plate is a frame around it.
  assert.match(block, /\[data-cc-morph="composer"\] > \.dsh-cc-morph \{\s*clip-path: polygon\(evenodd,/)
  // Reduced motion: the global switch stops the drift; the plate keeps a static quad.
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*html\[data-dsh-calling-card-skin\] \*,/)
  assert.match(plate, /clip-path: polygon\(/)
})
