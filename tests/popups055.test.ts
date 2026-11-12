import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { ACCOUNT, createRail, markRail, railRoot, readSessions } from '../src/client/rail.ts'

const css = readFileSync(new URL('../src/client/skin.css', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const start = css.indexOf('/* ===== 0.5.5 popups')
const reduce = css.lastIndexOf('@media (prefers-reduced-motion: reduce)')
const block = css.slice(start, reduce)

test('0.5.5 popups: menus, tooltips and hover cards get the cut-panel look, before reduced motion', () => {
  assert.ok(start > 0 && start < reduce)
  // One host Menu primitive covers account / context / model / permission / composer / open-with menus.
  assert.ok(block.includes(':is([data-menu-material], [data-dockkit-tab-menu])'))
  assert.match(block, /> \[class\*="_material_"\],\s*html\[data-dsh-calling-card-skin\] \[data-menu-backing\] \{\s*display: none !important;/)
  assert.match(block, /:not\(\[class\*="_submenu_"\]\)::before \{[^}]*z-index: -1;/)
  assert.match(block, /:not\(\[class\*="_submenu_"\]\)::after \{[^}]*background: var\(--dsh-cc-red\);/)
  // Items: hover / keyboard / open submenu lunge with inverted text and a drifting red quad.
  assert.ok(block.includes(':is(:hover, :focus-visible, [data-highlighted], [aria-expanded="true"])'))
  assert.match(block, /animation: dsh-cc-pop-quad [^;]+infinite alternate;/)
  assert.ok(block.includes('[class*="_danger_"]'))
  assert.ok(block.includes('[class*="_check"]'))
  assert.match(block, /span\[role="tooltip"\] kbd \{[^}]*background: var\(--dsh-cc-red\);/)
  assert.match(block, /\[role="separator"\] \{[^}]*linear-gradient/)
  // Slam-in uses the individual transform properties; the host positions tooltips with transform.
  assert.match(block, /animation: dsh-cc-pop-slam [^;]+backwards;/)
  assert.match(block, /@keyframes dsh-cc-pop-slam \{[^@]*translate:[^@]*scale:[^@]*rotate:/)
  const tip = block.slice(block.indexOf('html[data-dsh-calling-card-skin] span[role="tooltip"] {'))
  assert.doesNotMatch(tip.slice(0, tip.indexOf('}')), /\btransform:/)
  assert.ok(block.includes('body > span[class*="_portal_"] > div[class*="_card_"]:not([class*="_preview_"]):not([class*="_media_"])'))
  // No flashing.
  assert.doesNotMatch(block, /opacity|steps\(/)
  // Reduced motion: popups and the session action bar hold still (animations are off globally).
  const tail = css.slice(reduce)
  for (const selector of ['[data-menu-material]', '[data-dockkit-tab-menu]', '[role^="menuitem"]', 'span[role="tooltip"]', 'body > span[class*="_portal_"] > div[class*="_card_"]']) {
    assert.ok(tail.includes(selector), selector)
  }
  assert.match(tail, /\*::before,\s*html\[data-dsh-calling-card-skin\] \*::after \{\s*animation: none !important;/)
})

test('0.5.5 session tickets: actions only on hover / focus / open menu, never over the title', () => {
  assert.match(block, /\[data-row-key\^="session:"\] > \[class\*="_rowActions"\] \{\s*display: none !important;/)
  assert.ok(block.includes('[data-row-key^="session:"]:is(:hover, :focus-within, [class*="_menuOpen"]) > [class*="_rowActions"] {\n  display: inline-flex !important;'))
  assert.ok(block.includes('[data-row-key^="session:"]:is(:hover, :focus-within, [class*="_menuOpen"]) > [class*="_rowResting"] {\n  display: none !important;'))
  assert.match(block, /\[data-row-key\^="session:"\] > \[class\*="_title"\] \{\s*flex: 1 1 auto !important;\s*min-width: 0 !important;/)
  // The paper moved to ::before so the row's drop-shadows are not clipped away.
  assert.match(block, /\[data-row-key\^="session:"\] \{[^}]*background: transparent !important;\s*clip-path: none !important;/)
  assert.match(block, /\[data-row-key\^="session:"\]::before \{[^}]*z-index: -2;[^}]*clip-path: polygon/)
  assert.ok(block.includes('[data-row-key^="session:"][data-cc-morph] > .dsh-cc-morph'))
})

test('collapsed: the tagline turns into a vertical stamp; the brand clears the rail foot', () => {
  assert.match(block, /\[data-cc-rail\] \.dsh-cc-tagline \{[^}]*position: absolute;[^}]*rotate: -90deg;/)
  assert.match(block, /\[data-cc-rail\] \.dsh-cc-railbrand:not\(\[data-off\]\) \{\s*bottom: var\(--cc-rail-foot, 92px\);/)
  assert.match(block, /\[data-cc-rail-btn\]\[data-signed-out\]\[aria-haspopup="menu"\]::before \{\s*content: "MORE";/)
})

/** Host-like collapsed sidebar with a slot wrapper between the column and the root. */
function wrapped(collapsed: boolean, footVisible = false) {
  const hide = collapsed ? ' style="display:none"' : ''
  const footHide = collapsed && !footVisible ? ' style="display:none"' : ''
  const rows = collapsed ? '' : `
    <div role="treeitem" data-row-key="session:a" aria-selected="true"><span class="x_slot"></span><span class="x_title">检查令牌刷新</span><span class="x_rowResting"><span class="x_time">24天前</span></span><span class="x_rowActions"><button aria-label="…"></button></span></div>`
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="frame"${collapsed ? ' data-sidebar-collapsed=""' : ''}>
      <div id="col"><div id="slot"><div id="root">
        <div id="logo"><button data-sidebar-toggle aria-label="t"></button></div>
        <button id="new" aria-label="New Session"></button>
        <nav id="panels"${hide}><button aria-label="Plugins"></button></nav>
        <div id="region"${hide}><div id="list">${rows}</div></div>
        <div id="foot"${footHide}><div id="actions"><button aria-label="remote"></button></div><div id="settings"><button id="acct" data-signed-out="true" data-collapsed="${collapsed}" aria-haspopup="menu" aria-expanded="false"></button></div></div>
      </div></div></div>
      <div id="center"></div>
      <div data-shell-overlay><div class="dsh-cc-overlay"><nav class="dsh-cc-tickets"></nav><div class="dsh-cc-railbrand"></div></div></div>
    </div></body></html>`, { pretendToBeVisual: true })
  return dom.window
}

test('rail root: a slot wrapper around the sidebar no longer hides the panels and 更多', () => {
  const window = wrapped(true)
  const { document } = window
  assert.equal(railRoot(document.getElementById('col')!).id, 'root')
  markRail(document, window, true)
  assert.deepEqual(['panels', 'foot'].map((id) => document.getElementById(id)?.getAttribute('data-cc-rail-part')), ['', 'foot'])
  assert.equal(document.getElementById('slot')?.hasAttribute('data-cc-rail-part'), false)
  assert.ok(document.getElementById('acct')?.hasAttribute('data-cc-rail-btn'))
  assert.ok(document.querySelector(ACCOUNT) === document.getElementById('acct'))
})

test('rail foot: the account section is the foot even when the host leaves it visible', () => {
  const window = wrapped(true, true)
  const { document } = window
  markRail(document, window, true)
  assert.equal(document.getElementById('foot')?.getAttribute('data-cc-rail-part'), 'foot')
  assert.ok(document.getElementById('acct')?.hasAttribute('data-cc-rail-btn'))
})

test('rail brand gets the measured foot room; ticket titles skip the age label', () => {
  const open = wrapped(false)
  assert.deepEqual(readSessions(open.document), [{ key: 'session:a', title: '检查令牌刷新', selected: true }])
  const window = wrapped(true)
  const { document } = window
  const brand = document.querySelector<HTMLElement>('.dsh-cc-railbrand')
  const rail = createRail(document, window, document.querySelector<HTMLElement>('.dsh-cc-tickets'), brand)
  rail.sync()
  assert.match(brand?.style.getPropertyValue('--cc-rail-foot') ?? '', /^\d+px$/)
  rail.dispose()
  assert.equal(brand?.style.getPropertyValue('--cc-rail-foot'), '')
})

test('fixtures: popups page mirrors the host primitives; desktop fixture wraps the sidebar', () => {
  const menus = readFileSync(new URL('../preview/menus.html', import.meta.url), 'utf8')
  for (const needle of ['data-menu-material', 'data-context-menu', 'role="tooltip"', '_card_bgejw_', '_danger_', '_shortcut_', 'role="separator"', 'aria-checked="true"', '测试夹具']) {
    assert.ok(menus.includes(needle), needle)
  }
  const desktop = readFileSync(new URL('../preview/desktop.html', import.meta.url), 'utf8')
  assert.ok(desktop.includes('data-fixture-slot'))
  assert.ok(desktop.includes('wnFoaW_rowActions'))
  assert.ok(desktop.includes('data-menu-material'))
})
