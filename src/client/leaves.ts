const LEAF = 'data-cc-leaf'

/** Accurate short names for the real host pages. Unknown labels get no gloss. */
const GLOSS: Record<string, string> = {
  'new session': '新会话',
  'plugins': '插件',
  'automation tasks': '自动化',
  'more': '更多',
}

/**
 * Mark the real sidebar controls that carry a visible label so CSS can
 * draw them as stepped paper. Icon buttons, the collapse toggle, the
 * signed-out account control, and our own brand stay unmarked.
 * Attributes are removed when the skin unloads.
 */
export function syncNavLeaves(documentRef: Document): void {
  const side = sidebarColumn(documentRef)
  if (!side) return
  let index = 0
  for (const button of Array.from(side.querySelectorAll('button'))) {
    const text = (button.textContent || '').replace(/\s+/g, ' ').trim()
    const skip = text.length === 0
      || button.hasAttribute('data-sidebar-toggle')
      || button.hasAttribute('data-signed-out')
      || button.querySelector('.dsh-cc-name, .dsh-cc-mark') !== null
    if (skip) {
      button.removeAttribute(LEAF)
      button.removeAttribute('data-cc-num')
      button.removeAttribute('data-cc-gloss')
      button.removeAttribute('data-cc-lines')
      button.removeAttribute('data-cc-i')
      button.style.removeProperty('--cc-i')
      continue
    }
    button.setAttribute(LEAF, '')
    button.setAttribute('data-cc-i', String(index))
    button.setAttribute('data-cc-num', String(index + 1).padStart(2, '0'))
    button.setAttribute('data-cc-lines', text.length > 14 ? '2' : '1')
    const gloss = GLOSS[text.toLowerCase()]
    if (gloss) button.setAttribute('data-cc-gloss', gloss)
    else button.removeAttribute('data-cc-gloss')
    button.style.setProperty('--cc-i', String(index))
    index += 1
  }
}

export function clearNavLeaves(documentRef: Document): void {
  for (const button of Array.from(documentRef.querySelectorAll(`[${LEAF}]`))) {
    button.removeAttribute(LEAF)
    button.removeAttribute('data-cc-num')
    button.removeAttribute('data-cc-gloss')
    button.removeAttribute('data-cc-lines')
    button.removeAttribute('data-cc-i')
    const styled = button as { style?: { removeProperty: (name: string) => void } }
    styled.style?.removeProperty('--cc-i')
  }
}

const HERO_TITLE = 'data-cc-hero-title'
const HERO_TAG = 'data-cc-hero-tag'

/**
 * Mark the blank-session headline and its preview tag. The nodes stay the
 * host's text. Markers are removed with the skin.
 */
export function clearHeroType(documentRef: Document): void {
  for (const node of Array.from(documentRef.querySelectorAll(`[${HERO_TITLE}], [${HERO_TAG}], [data-cc-hero-group]`))) {
    node.removeAttribute(HERO_TITLE)
    node.removeAttribute(HERO_TAG)
    node.removeAttribute('data-cc-hero-group')
  }
}

export function syncHeroType(documentRef: Document): void {
  clearHeroType(documentRef)
  const mark = documentRef.querySelector('[data-phase="hero"] svg.dsh-cc-hero')
  if (!mark) return
  const phase = mark.closest('[data-phase]')
  let node: Element | null = mark
  let group: Element | null = null
  while (node && node !== phase) {
    const next = node.parentElement?.nextElementSibling
    const text = (next?.textContent || '').replace(/\s+/g, '')
    if (next && text.length > 0) {
      group = next
      break
    }
    node = node.parentElement
  }
  if (!group) return
  group.setAttribute('data-cc-hero-group', '')
  const title = group.firstElementChild
  const tag = group.lastElementChild !== title ? group.lastElementChild : null
  title?.setAttribute(HERO_TITLE, '')
  tag?.setAttribute(HERO_TAG, '')
}

function sidebarColumn(documentRef: Document): Element | null {
  const toggle = documentRef.querySelector('[data-sidebar-toggle]')
  const frame = documentRef.querySelector('div:has(> [data-shell-overlay])')
  if (!toggle || !frame) return null
  let node: Element | null = toggle
  while (node && node.parentElement !== frame) node = node.parentElement
  return node
}

export function syncSideWidth(documentRef: Document): void {
  const frame = documentRef.querySelector('div:has(> [data-shell-overlay])')
  const handle = frame?.querySelector('[data-side="sidebar"]')
  const raw = handle instanceof HTMLElement ? Number.parseFloat(handle.style.left) : Number.NaN
  const side = sidebarColumn(documentRef)
  const measured = side instanceof HTMLElement ? Math.round(side.getBoundingClientRect().width) : 0
  const width = Number.isFinite(raw) && raw > 0 ? Math.round(raw) : measured
  if (width > 0) documentRef.documentElement.style.setProperty('--dsh-cc-side', `${width}px`)
  const right = frame?.querySelector('[data-rightbar-col]')
  if (right instanceof HTMLElement) {
    documentRef.documentElement.style.setProperty('--dsh-cc-right', `${Math.round(right.getBoundingClientRect().width)}px`)
  }
}
