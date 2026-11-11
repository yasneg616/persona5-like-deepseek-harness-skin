import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { CAPTION_ATTR, chromeLabels, mountChrome, windowControls } from '../src/client/chrome.ts'

const CLUSTER = `
<div class="dsh-cc-chrome">
  <div class="dsh-cc-menus" role="menubar">
    <button type="button" class="dsh-cc-menu" data-menu="application" aria-expanded="false"><span class="dsh-cc-menu-label">应用</span></button>
    <button type="button" class="dsh-cc-menu" data-menu="edit" aria-expanded="false"><span class="dsh-cc-menu-label">编辑</span></button>
  </div>
  <div class="dsh-cc-wins">
    <button type="button" class="dsh-cc-win" data-win="minimize"></button>
    <button type="button" class="dsh-cc-win" data-win="maximize"></button>
    <button type="button" class="dsh-cc-win" data-win="close"></button>
  </div>
</div>`

function setup(lang = 'zh-Hans') {
  const dom = new JSDOM(`<!doctype html><html lang="${lang}" data-windows-titlebar><body>${CLUSTER}</body></html>`)
  const { window } = dom
  const root = window.document.querySelector('.dsh-cc-chrome') as HTMLElement
  return { window, document: window.document, root }
}

function stub(window: Window, state = { maximized: false }) {
  const calls: Array<[string, ...unknown[]]> = []
  const api = {
    invoke: async (action: string) => {
      calls.push(['invoke', action])
      if (action === 'maximize') state.maximized = true
      if (action === 'restore') state.maximized = false
      return { ...state, minimized: false }
    },
    menu: async (name: string, x: number, y: number) => {
      calls.push(['menu', name, x, y])
      return true
    },
  }
  ;(window as unknown as { dshDesktop: unknown }).dshDesktop = { windowControls: api }
  return calls
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

test('no desktop window-controls API: the host caption stays, nothing is hidden', () => {
  const { window, document, root } = setup()
  assert.equal(windowControls(window), null)
  ;(window as unknown as { dshDesktop: unknown }).dshDesktop = { windowControls: { invoke: 1 } }
  assert.equal(windowControls(window), null)
  const chrome = mountChrome(document, window, root)
  assert.equal(chrome.on, false)
  assert.equal(root.hasAttribute('data-on'), false)
  assert.equal(document.documentElement.hasAttribute(CAPTION_ATTR), false)
  chrome.dispose()
})

test('with the API: caption replaced, buttons call the real window controls, dispose restores', async () => {
  const { window, document, root } = setup()
  const calls = stub(window)
  const chrome = mountChrome(document, window, root)
  assert.equal(chrome.on, true)
  assert.equal(root.hasAttribute('data-on'), true)
  assert.equal(document.documentElement.hasAttribute(CAPTION_ATTR), true)
  await tick()
  assert.deepEqual(calls.shift(), ['invoke', 'state'])
  const win = (name: string) => root.querySelector(`.dsh-cc-win[data-win="${name}"]`) as HTMLButtonElement
  assert.equal(win('minimize').getAttribute('aria-label'), '最小化')
  assert.equal(win('close').getAttribute('title'), '关闭')
  win('minimize').click()
  win('maximize').click()
  await tick()
  assert.deepEqual(calls.splice(0), [['invoke', 'minimize'], ['invoke', 'maximize']])
  // Maximized: the tile says restore and calls restore next.
  assert.equal(win('maximize').hasAttribute('data-cc-max'), true)
  assert.equal(win('maximize').getAttribute('aria-label'), '还原')
  win('maximize').click()
  await tick()
  assert.deepEqual(calls.splice(0), [['invoke', 'restore']])
  assert.equal(win('maximize').hasAttribute('data-cc-max'), false)
  win('close').click()
  await tick()
  assert.deepEqual(calls.splice(0), [['invoke', 'close']])
  chrome.dispose()
  assert.equal(root.hasAttribute('data-on'), false)
  assert.equal(document.documentElement.hasAttribute(CAPTION_ATTR), false)
  win('minimize').click()
  await tick()
  assert.deepEqual(calls, [])
})

test('menu tabs open the native menu under the tab and keep editor focus', async () => {
  const { window, document, root } = setup()
  const calls = stub(window)
  const chrome = mountChrome(document, window, root)
  await tick()
  calls.splice(0)
  const edit = root.querySelector('.dsh-cc-menu[data-menu="edit"]') as HTMLButtonElement
  edit.getBoundingClientRect = () => ({ left: 812.6, bottom: 38, top: 6, right: 880, width: 67, height: 32, x: 812.6, y: 6, toJSON() {} }) as DOMRect
  const down = new window.MouseEvent('mousedown', { bubbles: true, cancelable: true })
  edit.dispatchEvent(down)
  assert.equal(down.defaultPrevented, true)
  edit.click()
  assert.equal(edit.getAttribute('aria-expanded'), 'true')
  await tick()
  await tick()
  assert.deepEqual(calls, [['menu', 'edit', 812.6, 38]])
  assert.equal(edit.getAttribute('aria-expanded'), 'false')
  // Roving focus between the two tabs.
  const app = root.querySelector('.dsh-cc-menu[data-menu="application"]') as HTMLButtonElement
  assert.equal(app.tabIndex, 0)
  assert.equal(edit.tabIndex, -1)
  app.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  assert.equal(edit.tabIndex, 0)
  assert.equal(document.activeElement, edit)
  chrome.dispose()
})

test('labels follow the app language and reuse the host menubar text when it is there', () => {
  assert.equal(chromeLabels('en-US').close, 'Close')
  assert.equal(chromeLabels('zh-Hans').maximize, '最大化')
  const { window, document, root } = setup('en')
  const host = document.createElement('div')
  host.setAttribute('data-windows-menu', '')
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = '<button>App</button><button>Edit</button>'
  document.documentElement.append(host)
  stub(window)
  const chrome = mountChrome(document, window, root)
  assert.deepEqual(Array.from(root.querySelectorAll('.dsh-cc-menu-label')).map((n) => n.textContent), ['App', 'Edit'])
  assert.equal(root.querySelector('[data-win="minimize"]')?.getAttribute('aria-label'), 'Minimize')
  chrome.dispose()
})

test('stylesheet: host caption hidden only under our caption, drag band and no-drag controls, collapsed rail', () => {
  const css = readFileSync(new URL('../src/client/skin.css', import.meta.url), 'utf8')
  const reduce = css.lastIndexOf('@media (prefers-reduced-motion: reduce)')
  assert.doesNotMatch(css, /dsh-cc-replay/)
  assert.match(css, /\[data-cc-caption\] :is\(\[data-windows-menu\], \[data-industrial-caption-fallback\]\) \{\s*display: none !important;/)
  // Every hiding rule is gated on data-cc-caption.
  for (const match of css.matchAll(/[^\n]*\[data-industrial-caption-fallback\][^\n]*/g)) assert.match(match[0], /\[data-cc-caption\]/)
  assert.match(css, /\[data-cc-caption\] \.dsh-cc-drag \{[^}]*-webkit-app-region: drag;/)
  assert.match(css, /\[data-cc-caption\] :is\(button,[^)]*\) \{\s*-webkit-app-region: no-drag;/)
  assert.match(css, /\[data-sidebar-collapsed\]:not\(\[data-sidebar-drawer\]\) \{\s*--dsh-cc-deck: var\(--dsh-cc-rail\);\s*grid-template-columns: var\(--dsh-cc-rail\)[^;]*!important;/)
  assert.match(css, /\[data-cc-rail-part\] \{\s*display: flex !important;/)
  assert.match(css, /\.dsh-cc-win\[data-win="close"\]\[data-cc-morph\] > \.dsh-cc-morph \{\s*background: #fff;/)
  // New motion stays inside the reduced-motion switch.
  for (const name of ['dsh-cc-rail-in', 'dsh-cc-blade-in', 'dsh-cc-ticket-in', 'dsh-cc-chrome-in', 'dsh-cc-brand-drop']) {
    const at = css.indexOf(`@keyframes ${name}`)
    assert.ok(at > 0 && at < reduce, name)
  }
  assert.match(css.slice(reduce), /\.dsh-cc-menu, \.dsh-cc-win, \[data-cc-rail-btn\], \.dsh-cc-ticket[^){]*\) \{\s*translate: none !important;/)
})
