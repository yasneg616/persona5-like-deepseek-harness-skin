import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { syncNavLeaves } from '../src/client/leaves.ts'
import { RAIL_ATTR, clearRailMarks, createRail, markRail, railCollapsed, readSessions } from '../src/client/rail.ts'

/** Host-like shell: frame > sidebar column > root > sections, like the desktop sidebar. */
function shell(collapsed: boolean) {
  const hide = collapsed ? ' style="display:none"' : ''
  const rows = collapsed ? '' : `
    <div role="treeitem" data-row-key="workspace:w">Project</div>
    <div role="treeitem" data-row-key="session:a" aria-selected="true">检查令牌刷新</div>
    <div role="treeitem" data-row-key="session:b" aria-selected="false">Refactor auth</div>`
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="frame"${collapsed ? ' data-sidebar-collapsed=""' : ''}>
      <div id="col"><div id="root">
        <div id="logo"><button data-sidebar-toggle aria-label="t"></button></div>
        <button id="new" aria-label="New Session">${collapsed ? '' : 'New Session'}</button>
        <nav id="panels"${hide}><button aria-label="Plugins" aria-current="page"></button><button aria-label="Automation"></button></nav>
        <div id="region"${hide}><div id="wide" style="display:none"><button aria-label="add">+</button></div><button aria-label="search"></button><div id="list">${rows}</div></div>
        <div id="foot"${hide}><button aria-label="settings"></button></div>
      </div></div>
      <div id="center"></div>
      <div data-shell-overlay><div class="dsh-cc-overlay"><nav class="dsh-cc-tickets"></nav><div class="dsh-cc-railbrand"></div></div></div>
    </div></body></html>`, { pretendToBeVisual: true })
  return dom.window
}

test('sessions: titles, keys and the selected flag only, capped', () => {
  const window = shell(false)
  assert.deepEqual(readSessions(window.document), [
    { key: 'session:a', title: '检查令牌刷新', selected: true },
    { key: 'session:b', title: 'Refactor auth', selected: false },
  ])
  assert.equal(readSessions(window.document, 1).length, 1)
  assert.equal(railCollapsed(window.document), false)
})

test('collapsed: host sections shown again as tickets, wide-only parts stay hidden, marks clear on expand', () => {
  const window = shell(true)
  const { document } = window
  assert.equal(railCollapsed(document), true)
  const count = markRail(document, window, true)
  assert.equal(document.getElementById('root')?.hasAttribute('data-cc-rail-root'), true)
  assert.deepEqual(['panels', 'region', 'foot'].map((id) => document.getElementById(id)?.getAttribute('data-cc-rail-part')), ['', '', 'foot'])
  assert.equal(document.getElementById('wide')?.hasAttribute('data-cc-rail-part'), false)
  assert.equal(document.querySelector('[data-sidebar-toggle]')?.hasAttribute('data-cc-rail-btn'), false)
  assert.equal(document.getElementById('new')?.getAttribute('data-cc-rail-btn'), '01')
  // The wide-only button inside a shown section stays hidden and gets no ticket number.
  assert.equal(document.querySelector('#wide button')?.hasAttribute('data-cc-rail-btn'), false)
  assert.equal(count, 5)
  // Sticky: once shown, a section stays marked even though it is no longer display:none.
  document.getElementById('panels')?.removeAttribute('style')
  markRail(document, window, true)
  assert.equal(document.getElementById('panels')?.hasAttribute('data-cc-rail-part'), true)
  markRail(document, window, false)
  assert.equal(document.querySelectorAll('[data-cc-rail-btn], [data-cc-rail-part], [data-cc-rail-root]').length, 0)
})

test('collapsed: no paper leaves; expanded: labeled buttons are leaves again', () => {
  const open = shell(false)
  syncNavLeaves(open.document)
  assert.equal(open.document.getElementById('new')?.hasAttribute('data-cc-leaf'), true)
  const closed = shell(true)
  closed.document.getElementById('new')!.textContent = 'New Session'
  closed.document.getElementById('new')!.setAttribute('data-cc-leaf', '')
  syncNavLeaves(closed.document)
  assert.equal(closed.document.querySelectorAll('[data-cc-leaf]').length, 0)
})

test('rail tickets: remembered from the expanded list, a click expands and opens the real row', async () => {
  const window = shell(false)
  const { document } = window
  const frame = document.getElementById('frame')!
  const list = document.getElementById('list')!
  const nav = document.querySelector<HTMLElement>('.dsh-cc-tickets')
  const rail = createRail(document, window, nav, document.querySelector<HTMLElement>('.dsh-cc-railbrand'))
  rail.sync()
  assert.equal(rail.sessions().length, 2)
  assert.equal(nav?.children.length, 0)
  assert.equal(document.documentElement.hasAttribute(RAIL_ATTR), false)
  // Collapse like the host: attribute on, rows unmounted, sections hidden.
  const saved = list.innerHTML
  list.innerHTML = ''
  frame.setAttribute('data-sidebar-collapsed', '')
  rail.sync()
  assert.equal(document.documentElement.hasAttribute(RAIL_ATTR), true)
  const tickets = Array.from(nav?.querySelectorAll<HTMLButtonElement>('.dsh-cc-ticket') ?? [])
  assert.equal(tickets.length, 2)
  assert.equal(tickets[0].getAttribute('aria-label'), '检查令牌刷新')
  assert.equal(tickets[0].getAttribute('aria-current'), 'true')
  assert.equal(tickets[1].hasAttribute('aria-current'), false)
  assert.equal(tickets[1].querySelector('.dsh-cc-ticket-glyph')?.textContent, 'R')
  assert.equal(tickets[1].querySelector('.dsh-cc-ticket-num')?.textContent, '02')
  assert.equal(tickets[1].querySelector('.dsh-cc-ticket-tip')?.textContent, 'Refactor auth')
  // Click: the toggle expands (rows come back), then the real row is clicked.
  const opened: string[] = []
  document.querySelector('[data-sidebar-toggle]')!.addEventListener('click', () => {
    frame.removeAttribute('data-sidebar-collapsed')
    setTimeout(() => {
      list.innerHTML = saved
      for (const row of Array.from(list.querySelectorAll('[data-row-key^="session:"]'))) {
        row.addEventListener('click', () => opened.push(row.getAttribute('data-row-key')!))
      }
    }, 20)
  })
  tickets[1].click()
  await new Promise((resolve) => setTimeout(resolve, 200))
  assert.deepEqual(opened, ['session:b'])
  rail.dispose()
  assert.equal(document.documentElement.hasAttribute(RAIL_ATTR), false)
  assert.equal(nav?.children.length, 0)
  clearRailMarks(document)
})
