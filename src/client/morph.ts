/**
 * Selected plate.
 *
 * Like the P5 menu highlight: a picked box gets one red quad behind its
 * content, in place, whose corners keep drifting smoothly, and its text
 * flips to the inverse color. The plate is a single decorative element
 * appended to the box: absolutely placed behind the content, hidden from
 * assistive tech, ignoring the pointer, and only ever reaching outward
 * from the box, so text is never clipped and the hit area stays put. Only
 * selected, hovered or focused boxes get one, capped at a handful; the
 * rest stay static. Under reduced motion the plate is a still rectangle.
 * Everything is stripped on deselect and on dispose.
 */
export const MORPH = 'data-cc-morph'
/** Set when the host was `position: static`, so the layer can anchor to it. */
export const MORPH_POS = 'data-cc-morph-pos'
/** Set when the host clips its overflow: the layer then sits inside the box. */
export const MORPH_FIT = 'data-cc-morph-fit'
export const MORPH_LAYER = 'dsh-cc-morph'
export const MORPH_SEED = '--cc-morph-seed'
/** At most this many boxes morph at once. */
export const MORPH_CAP = 8

export type MorphKind = 'leaf' | 'row' | 'composer' | 'button' | 'cap-no' | 'cap-body' | 'tag'

/** Always-selected states, in priority order. */
const STATE: Array<[string, MorphKind]> = [
  ['[data-cc-leaf][aria-current="page"]', 'leaf'],
  ['[data-row-key^="session:"][aria-selected="true"]', 'row'],
  ['.dsh-cc-caption-no', 'cap-no'],
  ['.dsh-cc-caption-body', 'cap-body'],
  ['[data-cc-hero-tag]', 'tag'],
  ['[data-cc-rail-btn][aria-current="page"]', 'button'],
]
const HOVER = '[data-cc-leaf], [data-row-key^="session:"], [data-composer-card] button, '
  + '.dsh-cc-win, .dsh-cc-menu, [data-sidebar-toggle], [data-cc-rail-btn], .dsh-cc-ticket, '
  + '[data-presented-file], [data-open-target] button, [data-turn-trigger] > button, [data-code-block-banner] button, '
  + '[data-terminal] [class*="_copyButton"], [data-approval-key] [class*="_actionRow"] button'
const COMPOSER = '[data-composer-card]'

export interface MorphTracker {
  /** Re-read selection, hover and focus; returns how many boxes morph. */
  sync(): number
  /** Boxes currently morphing, for tests and the fixture. */
  active(): Element[]
  dispose(): void
}

function kindOf(node: Element): MorphKind {
  if (node.matches('[data-cc-leaf]')) return 'leaf'
  if (node.matches('[data-row-key^="session:"]')) return 'row'
  return 'button'
}

function matchesSafe(node: Element, selector: string): boolean {
  try {
    return node.matches(selector)
  } catch {
    return false
  }
}

export function createMorphTracker(documentRef: Document, windowRef: Window): MorphTracker {
  const armed = new Map<Element, HTMLElement>()
  let hovered: Element | null = null
  let seed = 0

  const canHover = () => {
    try {
      return windowRef.matchMedia('(hover: hover)').matches
    } catch {
      return false
    }
  }

  const strip = (node: Element) => {
    armed.get(node)?.remove()
    for (const stray of Array.from(node.children)) {
      if (stray.classList.contains(MORPH_LAYER)) stray.remove()
    }
    node.removeAttribute(MORPH)
    node.removeAttribute(MORPH_POS)
    node.removeAttribute(MORPH_FIT)
    ;(node as HTMLElement).style?.removeProperty(MORPH_SEED)
    armed.delete(node)
  }

  const buildLayer = () => {
    const layer = documentRef.createElement('span')
    layer.className = MORPH_LAYER
    layer.setAttribute('aria-hidden', 'true')
    return layer
  }

  const arm = (node: Element, kind: MorphKind) => {
    if (node.getAttribute(MORPH) !== kind) node.setAttribute(MORPH, kind)
    let layer = armed.get(node)
    if (layer && layer.parentElement === node) return
    if (!layer) {
      const style = windowRef.getComputedStyle(node)
      if (style.position === 'static' || style.position === '') node.setAttribute(MORPH_POS, 'rel')
      const clips = [style.overflowX, style.overflowY, style.overflow].some((value) => value && value !== 'visible')
      if (clips) node.setAttribute(MORPH_FIT, 'in')
      ;(node as HTMLElement).style?.setProperty(MORPH_SEED, String(seed++ % 7))
      layer = buildLayer()
      armed.set(node, layer)
    }
    // Appended last so the host's own first-child rules and labels are untouched.
    node.append(layer)
  }

  const wanted = () => {
    const next = new Map<Element, MorphKind>()
    const add = (node: Element | null, kind: MorphKind) => {
      if (!node || next.has(node) || next.size >= MORPH_CAP || !node.isConnected) return
      next.set(node, kind)
    }
    for (const [selector, kind] of STATE) {
      for (const node of Array.from(documentRef.querySelectorAll(selector))) add(node, kind)
    }
    const focused = documentRef.activeElement
    if (focused && focused !== documentRef.body) {
      add(focused.closest(COMPOSER), 'composer')
      const box = focused.closest(HOVER)
      if (box && matchesSafe(box, ':focus-visible')) add(box, kindOf(box))
    }
    if (hovered && canHover()) add(hovered, kindOf(hovered))
    return next
  }

  const sync = () => {
    const next = wanted()
    for (const node of Array.from(armed.keys())) if (!next.has(node)) strip(node)
    for (const [node, kind] of next) arm(node, kind)
    return next.size
  }

  const onOver = (event: Event) => {
    const target = event.target as Element | null
    const box = target && typeof target.closest === 'function' ? target.closest(HOVER) : null
    if (box === hovered) return
    hovered = box
    sync()
  }
  const onOut = (event: Event) => {
    if (!hovered) return
    const next = (event as PointerEvent).relatedTarget as Node | null
    if (next && hovered.contains(next)) return
    hovered = null
    sync()
  }
  const onFocus = () => sync()
  documentRef.addEventListener('pointerover', onOver, true)
  documentRef.addEventListener('pointerout', onOut, true)
  documentRef.addEventListener('focusin', onFocus, true)
  documentRef.addEventListener('focusout', onFocus, true)

  return {
    sync,
    active: () => Array.from(armed.keys()),
    dispose() {
      documentRef.removeEventListener('pointerover', onOver, true)
      documentRef.removeEventListener('pointerout', onOut, true)
      documentRef.removeEventListener('focusin', onFocus, true)
      documentRef.removeEventListener('focusout', onFocus, true)
      for (const node of Array.from(armed.keys())) strip(node)
      for (const node of Array.from(documentRef.querySelectorAll(`[${MORPH}]`))) strip(node)
      for (const layer of Array.from(documentRef.querySelectorAll(`.${MORPH_LAYER}`))) layer.remove()
      hovered = null
    },
  }
}
