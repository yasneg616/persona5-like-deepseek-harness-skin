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
  // One decorative layer, last child, hidden from assistive tech, three plates, no text.
  const [layer] = layerOf(plugins)
  assert.equal(plugins.lastElementChild, layer)
  assert.equal(layer.getAttribute('aria-hidden'), 'true')
  assert.deepEqual(Array.from(layer.children).map((plate) => plate.className), [
    `${MORPH_LAYER}-under`, `${MORPH_LAYER}-plate`, `${MORPH_LAYER}-line`,
  ])
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

test('morph CSS: clip-path-only stepped keyframes, 4-7 point shapes, layer never takes the pointer', () => {
  const css = readFileSync(new URL('../src/client/skin.css', import.meta.url), 'utf8')
  const vertices = (frame: string) => {
    const body = frame.replace(/^polygon\((evenodd,\s*)?/, '').replace(/\)$/, '')
    let depth = 0
    let count = 1
    for (const ch of body) {
      if (ch === '(') depth += 1
      else if (ch === ')') depth -= 1
      else if (ch === ',' && depth === 0) count += 1
    }
    return count
  }
  for (const name of ['plate', 'under', 'line']) {
    const block = css.match(new RegExp(`@keyframes dsh-cc-morph-${name} \\{([\\s\\S]*?)\\n\\}`))
    assert.ok(block, name)
    const frames = Array.from(block![1].matchAll(/\{ clip-path: (polygon\(.*\)); \}/g)).map((match) => match[1])
    assert.ok(frames.length >= 8, `${name} frames`)
    assert.doesNotMatch(block![1], /transform|opacity|width|height|inset/)
    const counts = new Set(frames.map(vertices))
    assert.equal(counts.size, 1, `${name} keeps one vertex count`)
    const [count] = counts
    if (name === 'line') {
      assert.match(frames[0], /^polygon\(evenodd,/)
      assert.equal(count, 10)
    } else {
      assert.ok(count >= 4 && count <= 7, `${name} has ${count} points`)
    }
    assert.ok(new Set(frames).size >= frames.length - 1, `${name} shapes differ`)
  }
  const layer = css.match(/\.dsh-cc-morph \{([\s\S]*?)\}/)![1]
  assert.match(layer, /pointer-events: none/)
  assert.match(layer, /z-index: -1/)
  assert.match(css, /\.dsh-cc-morph > i \{[\s\S]*?animation-timing-function: steps\(1, end\)/)
  // Host keeps its text: no clip on the host while it morphs.
  assert.match(css, /\[data-cc-morph\] \{[\s\S]*?clip-path: none !important/)
  // Reduced motion: the global switch stops these too and the plates keep a static polygon.
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*html\[data-dsh-calling-card-skin\] \*,/)
  assert.match(css, /\.dsh-cc-morph-plate \{[\s\S]*?clip-path: polygon\(/)
})
