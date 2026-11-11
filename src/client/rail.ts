import { sidebarColumn } from './leaves.ts'

/**
 * Collapsed sidebar as a calling-card strip.
 *
 * Collapsed, the Windows host hides its panel list, workspace rail and footer
 * (`display: none`) and stops rendering session rows. We keep the real
 * controls: every hidden ancestor of a real sidebar button is marked
 * `data-cc-rail-part` (the stylesheet shows it again as a column) and each
 * button becomes a numbered ticket (`data-cc-rail-btn`). Recent sessions are
 * remembered from the expanded list (key, title, selected; nothing else) and
 * drawn as tickets in our overlay. Clicking one expands the sidebar and
 * clicks the real row, so the host does the navigation. All marks are removed
 * on expand and on unload.
 */
export const RAIL_ATTR = 'data-cc-rail'
const BTN = 'data-cc-rail-btn'
const PART = 'data-cc-rail-part'
const ROOT = 'data-cc-rail-root'
export const RAIL_MAX = 8
const TICKET_STEP = 48
const ROW_WAIT_MS = 1200

export interface RailSession { key: string, title: string, selected: boolean }

export function railCollapsed(documentRef: Document): boolean {
  const frame = documentRef.querySelector('div:has(> [data-shell-overlay])')
  return frame != null && frame.hasAttribute('data-sidebar-collapsed') && !frame.hasAttribute('data-sidebar-drawer')
}

function rowTitle(row: Element): string {
  const label = row.getAttribute('aria-label')?.trim()
  // Real rows hold a time label and action buttons next to the title span; read the title only.
  const titleSpan = row.querySelector(':scope > [class*="_title"]')
  const text = ((titleSpan ?? row).textContent || '').replace(/\s+/g, ' ').trim()
  return (label || text).slice(0, 80)
}

/** Visible session rows in document order, capped. Titles only. */
export function readSessions(documentRef: Document, max = RAIL_MAX): RailSession[] {
  const rows = Array.from(documentRef.querySelectorAll('[data-row-key^="session:"]'))
  const out: RailSession[] = []
  for (const row of rows) {
    const key = row.getAttribute('data-row-key') || ''
    const title = rowTitle(row)
    if (!key || !title || out.some((item) => item.key === key)) continue
    out.push({ key, title, selected: row.getAttribute('aria-selected') === 'true' })
    if (out.length >= max) break
  }
  return out
}

function firstGlyph(title: string): string {
  const match = title.match(/[\p{L}\p{N}]/u)
  return (match ? match[0] : '#').toUpperCase()
}

/** Mark the real collapsed-sidebar controls; sticky while collapsed so unhidden parts are not re-hidden. */
export function markRail(documentRef: Document, windowRef: Window, collapsed: boolean): number {
  const side = sidebarColumn(documentRef)
  if (!side || !collapsed) {
    clearRailMarks(documentRef)
    return 0
  }
  const root = railRoot(side)
  if (root && root !== side && !root.hasAttribute(ROOT)) root.setAttribute(ROOT, '')
  let index = 0
  let lastPart: Element | null = null
  for (const button of Array.from(side.querySelectorAll('button'))) {
    const skip = button.hasAttribute('data-sidebar-toggle')
      || button.hasAttribute('data-cc-leaf')
      || button.querySelector('.dsh-cc-name, .dsh-cc-mark') !== null
      || button.closest('[role="menu"], [role="dialog"]') !== null
    if (skip) {
      button.removeAttribute(BTN)
      continue
    }
    // Only the root's own sections are shown again (the host hides those when collapsed);
    // anything hidden deeper is hidden on purpose (wide-only headers) and stays hidden.
    let section: Element | null = button
    while (section && section.parentElement !== root) section = section.parentElement
    if (section && section !== button && (section.hasAttribute(PART) || windowRef.getComputedStyle(section).display === 'none')) {
      if (!section.hasAttribute(PART)) section.setAttribute(PART, '')
    }
    if (hiddenWithin(windowRef, button, section)) {
      button.removeAttribute(BTN)
      continue
    }
    index += 1
    const num = String(index).padStart(2, '0')
    if (button.getAttribute(BTN) !== num) button.setAttribute(BTN, num)
    if (section && section.hasAttribute(PART)) lastPart = section
  }
  // The account / 更多 control always gets its own foot ticket, even when the host keeps
  // its section in the layout (not display:none) or a wrapper sits around the sidebar.
  const account = side.querySelector(ACCOUNT)
  let accountPart: Element | null = account
  while (accountPart && accountPart.parentElement !== root) accountPart = accountPart.parentElement
  if (account && accountPart && accountPart !== account) {
    if (!accountPart.hasAttribute(PART)) accountPart.setAttribute(PART, '')
    lastPart = accountPart
  }
  for (const part of Array.from(side.querySelectorAll(`[${PART}]`))) {
    const want = part === lastPart && (index > 1 || part === accountPart) ? 'foot' : ''
    if (part.getAttribute(PART) !== want) part.setAttribute(PART, want)
  }
  return index
}

/** True when something between the button and its section is display:none (wide-only parts). */
function hiddenWithin(windowRef: Window, button: Element, section: Element | null): boolean {
  let node: Element | null = button
  while (node && node !== section) {
    if (windowRef.getComputedStyle(node).display === 'none') return true
    node = node.parentElement
  }
  return false
}

/** The host's account / 更多 trigger (signed in or out). */
export const ACCOUNT = 'button[data-signed-out][aria-haspopup="menu"]'

/**
 * The sidebar root: the lowest ancestor of the collapse toggle that holds the sidebar's
 * sections (three or more element children), so slot wrappers between the column and
 * the host's root do not hide the sections from the rail.
 */
export function railRoot(side: Element): Element {
  const toggle = side.querySelector('[data-sidebar-toggle]')
  let node: Element | null = toggle?.parentElement ?? null
  while (node && node !== side) {
    if (node.children.length >= 3) return node
    node = node.parentElement
  }
  let top: Element | null = toggle
  while (top && top.parentElement !== side) top = top.parentElement
  return top ?? side.firstElementChild ?? side
}

export function clearRailMarks(documentRef: Document): void {
  for (const node of Array.from(documentRef.querySelectorAll(`[${BTN}], [${PART}], [${ROOT}]`))) {
    node.removeAttribute(BTN)
    node.removeAttribute(PART)
    node.removeAttribute(ROOT)
  }
}

export interface Rail {
  sync(): void
  sessions(): RailSession[]
  dispose(): void
}

export function createRail(documentRef: Document, windowRef: Window, nav: HTMLElement | null, brand: HTMLElement | null): Rail {
  const html = documentRef.documentElement
  let snapshot: RailSession[] = []
  let drawnKey = ''
  let waitTimer = 0
  let disposed = false

  const open = (key: string) => {
    const quoted = key.replace(/["\\]/g, '\\$&')
    const find = () => documentRef.querySelector<HTMLElement>(`[data-row-key="${quoted}"]`)
    const direct = find()
    if (direct) {
      direct.click()
      return
    }
    documentRef.querySelector<HTMLButtonElement>('[data-sidebar-toggle]')?.click()
    const started = Date.now()
    const poll = () => {
      if (disposed) return
      const row = find()
      if (row) {
        row.click()
        return
      }
      if (Date.now() - started < ROW_WAIT_MS) waitTimer = windowRef.setTimeout(poll, 60)
    }
    windowRef.clearTimeout(waitTimer)
    waitTimer = windowRef.setTimeout(poll, 60)
  }

  const onClick = (event: Event) => {
    const ticket = (event.target as Element | null)?.closest<HTMLElement>('.dsh-cc-ticket')
    const key = ticket?.getAttribute('data-key')
    if (key) open(key)
  }
  nav?.addEventListener('click', onClick)

  const draw = (items: RailSession[]) => {
    if (!nav) return
    const key = items.map((item) => `${item.key}:${item.title}:${item.selected ? 1 : 0}`).join('|')
    if (key === drawnKey) return
    drawnKey = key
    nav.replaceChildren()
    items.forEach((item, index) => {
      const button = documentRef.createElement('button')
      button.type = 'button'
      button.className = 'dsh-cc-ticket'
      button.setAttribute('data-key', item.key)
      button.setAttribute('aria-label', item.title)
      if (item.selected) button.setAttribute('aria-current', 'true')
      button.style.setProperty('--cc-t', String(index))
      const num = documentRef.createElement('span')
      num.className = 'dsh-cc-ticket-num'
      num.setAttribute('aria-hidden', 'true')
      num.textContent = String(index + 1).padStart(2, '0')
      const glyph = documentRef.createElement('span')
      glyph.className = 'dsh-cc-ticket-glyph'
      glyph.setAttribute('aria-hidden', 'true')
      glyph.textContent = firstGlyph(item.title)
      const tip = documentRef.createElement('span')
      tip.className = 'dsh-cc-ticket-tip'
      tip.setAttribute('aria-hidden', 'true')
      tip.textContent = item.title
      button.append(num, glyph, tip)
      nav.append(button)
    })
  }

  /** Room between the lowest real rail control and the rail brand. */
  const layout = (items: RailSession[]) => {
    if (!nav) return items
    const side = sidebarColumn(documentRef)
    const height = windowRef.innerHeight || 800
    const sideRect = side?.getBoundingClientRect()
    const footLine = (sideRect && sideRect.height > 0 ? sideRect.bottom : height) - 150
    let top = 120
    for (const button of Array.from(side?.querySelectorAll(`[${BTN}]`) ?? [])) {
      const rect = button.getBoundingClientRect()
      if (rect.height > 0 && rect.top < footLine) top = Math.max(top, rect.bottom + 22)
    }
    // The foot (account / 更多 and any footer actions) keeps its room; the brand sits above it.
    const foot = side?.querySelector(`[${PART}="foot"]`)
    const footRect = foot?.getBoundingClientRect()
    const footTop = footRect && footRect.height > 0 ? footRect.top : height - 84
    const footRoom = Math.max(84, Math.round(height - footTop + 12))
    const brandTall = brand ? Math.min(brand.scrollHeight || 210, 230) : 0
    let bottom = height - footRoom - brandTall
    let fit = Math.floor((bottom - top) / TICKET_STEP)
    let brandOff = false
    if (fit < Math.min(2, items.length) && brand) {
      brandOff = true
      bottom = height - footRoom
      fit = Math.floor((bottom - top) / TICKET_STEP)
    }
    brand?.toggleAttribute('data-off', brandOff)
    brand?.style.setProperty('--cc-rail-foot', `${footRoom}px`)
    nav.style.setProperty('--cc-rail-top', `${Math.round(top)}px`)
    return items.slice(0, Math.max(0, fit))
  }

  const sync = () => {
    const collapsed = railCollapsed(documentRef)
    markRail(documentRef, windowRef, collapsed)
    if (collapsed) html.setAttribute(RAIL_ATTR, '')
    else html.removeAttribute(RAIL_ATTR)
    if (!collapsed) {
      const rows = readSessions(documentRef)
      if (rows.length) snapshot = rows
      draw([])
      return
    }
    draw(layout(snapshot))
  }

  return {
    sync,
    sessions: () => snapshot.slice(),
    dispose() {
      disposed = true
      windowRef.clearTimeout(waitTimer)
      nav?.removeEventListener('click', onClick)
      nav?.replaceChildren()
      brand?.removeAttribute('data-off')
      brand?.style.removeProperty('--cc-rail-foot')
      html.removeAttribute(RAIL_ATTR)
      clearRailMarks(documentRef)
    },
  }
}
