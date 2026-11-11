/**
 * Optional calling-card letters for conversation messages.
 *
 * "plain" (default) leaves every message untouched. "collage" appends one
 * aria-hidden clone to a settled paragraph or heading and cuts that clone into
 * mixed-face paper letters; the host's own text nodes stay in place (shrunk to
 * zero size), so React keeps updating them and assistive tech keeps reading
 * them. Lists, tables, quotes, code and tool cards always stay plain, and the
 * cost is capped per block, per message and by the number of recent messages.
 */
export type LetterMode = 'plain' | 'collage'

export const MODE_KEY = 'dsh-cc-message-style'
export const MODE_ATTR = 'data-cc-letters'
/** A paragraph longer than this stays plain. */
export const BLOCK_MAX = 220
/** Letters cut per message; later blocks fall back to plain. */
export const FLOW_BUDGET = 480
/** Only the most recent messages are cut. */
export const MAX_FLOWS = 12
export const SETTLE_MS = 500

const CLONE = 'dsh-cc-collage'
const MARK = 'data-cc-collage'
const PENDING = 'data-cc-collage-pending'
const STABLE = 'data-cc-collage-since'
const FLOWS = '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"], [data-chat-flow-kind="assistant-step"]'
const BLOCKS = 'p, h1, h2, h3, h4'
/** Never cut inside these. */
const PLAIN_ZONE = 'li, table, blockquote, pre, code, details, [data-composer-card], [contenteditable="true"], .katex, mjx-container'
/** Inline nodes copied as-is into the clone: links stay clickable, code stays code. */
const KEEP = 'a[href], code, kbd, samp, img, svg, math, .katex, mjx-container, input, button'

const LATIN = ['Anton', 'ArchivoBlack', 'AbrilFatface', 'CcLatin'] as const
const CJK = ['CcHeavy', 'CcSerif', 'CcDisplay', 'CcHeavy'] as const

export function normalizeMode(value: unknown): LetterMode {
  return value === 'collage' ? 'collage' : 'plain'
}

export function readMode(storage: Pick<Storage, 'getItem'> | null | undefined): LetterMode {
  try {
    return normalizeMode(storage?.getItem(MODE_KEY))
  } catch {
    return 'plain'
  }
}

export function writeMode(storage: Pick<Storage, 'setItem'> | null | undefined, mode: LetterMode): void {
  try {
    storage?.setItem(MODE_KEY, mode)
  } catch {
    // Private mode or a blocked store: the choice lasts for this page only.
  }
}

function isCjk(character: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(character)
}

/** Closing punctuation sticks to the letter before it, so no line starts with it. */
function isClosing(character: string): boolean {
  return /[，。、；：！？）」』》〉】,.;:!?)\]}'"”’…%]/.test(character)
}

function isWordChar(character: string): boolean {
  return /[A-Za-z0-9\u00c0-\u024f'’\-_]/.test(character)
}

/** Deterministic scatter so a repaint gives the same letters. */
function scatter(index: number, seed: number): number {
  const x = Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function hashText(text: string): number {
  let h = 7
  for (let i = 0; i < Math.min(text.length, 64); i += 1) h = (h * 31 + text.charCodeAt(i)) % 9973
  return h
}

/** Visible text of a block, ignoring our own clone. */
export function sourceText(block: Element): string {
  let text = ''
  for (const node of Array.from(block.childNodes)) {
    if (node.nodeType === 1 && (node as Element).classList.contains(CLONE)) continue
    text += node.textContent ?? ''
  }
  return text
}

function letterCount(text: string): number {
  let n = 0
  for (const character of text) if (character.trim().length > 0) n += 1
  return n
}

interface Cursor { index: number, seed: number }

function cutText(documentRef: Document, text: string, cursor: Cursor, target: Node): void {
  let group: HTMLElement | null = null
  let groupKind: 'latin' | 'cjk' | null = null
  for (const character of text) {
    if (character.trim().length === 0) {
      group = null
      groupKind = null
      target.appendChild(documentRef.createTextNode(character === '\n' ? ' ' : character))
      continue
    }
    const kind = isCjk(character) ? 'cjk' : 'latin'
    const joins = group !== null && (isClosing(character) || (kind === 'latin' && groupKind === 'latin' && isWordChar(character)))
    if (!joins) {
      group = documentRef.createElement('span')
      group.className = 'dsh-cc-word'
      target.appendChild(group)
      groupKind = kind
    }
    const r = scatter(cursor.index, cursor.seed)
    const faces = kind === 'cjk' ? CJK : LATIN
    const tile = documentRef.createElement('span')
    tile.className = 'dsh-cc-han'
    tile.setAttribute('data-cc-face', faces[Math.floor(r * faces.length) % faces.length])
    // Punctuation is bare ink, never its own paper.
    const tone = /[\p{P}\p{S}]/u.test(character) ? 4 : Math.floor(scatter(cursor.index, cursor.seed + 3) * 5)
    tile.setAttribute('data-cc-han', String(tone))
    if (tone === 4 && /[\p{P}\p{S}]/u.test(character)) tile.setAttribute('data-cc-punct', '')
    tile.style.setProperty('--cc-r', (r * 2 - 1).toFixed(2))
    tile.textContent = character
    group!.appendChild(tile)
    cursor.index += 1
  }
}

function cutNodes(documentRef: Document, nodes: Node[], cursor: Cursor, target: Node): void {
  for (const node of nodes) {
    if (node.nodeType === 3) {
      cutText(documentRef, node.textContent ?? '', cursor, target)
      continue
    }
    if (node.nodeType !== 1) continue
    const element = node as Element
    if (element.classList.contains(CLONE)) continue
    if (element.tagName === 'BR') {
      target.appendChild(documentRef.createElement('br'))
      continue
    }
    if (element.matches(KEEP)) {
      const copy = element.cloneNode(true) as Element
      copy.removeAttribute('id')
      copy.classList.add('dsh-cc-kept')
      target.appendChild(copy)
      continue
    }
    const wrap = documentRef.createElement('span')
    wrap.className = 'dsh-cc-inline'
    const tag = element.tagName.toLowerCase()
    if (tag === 'strong' || tag === 'b') wrap.setAttribute('data-cc-strong', '')
    if (tag === 'em' || tag === 'i') wrap.setAttribute('data-cc-em', '')
    cutNodes(documentRef, Array.from(element.childNodes), cursor, wrap)
    target.appendChild(wrap)
  }
}

export function buildClone(documentRef: Document, block: Element, text: string): HTMLElement {
  const clone = documentRef.createElement('span')
  clone.className = CLONE
  clone.setAttribute('aria-hidden', 'true')
  cutNodes(documentRef, Array.from(block.childNodes), { index: 0, seed: hashText(text) }, clone)
  return clone
}

export function unpaintBlock(block: Element): void {
  for (const node of Array.from(block.children)) if (node.classList.contains(CLONE)) node.remove()
  block.removeAttribute(MARK)
  block.removeAttribute(PENDING)
  block.removeAttribute(STABLE)
}

function selectionInside(block: Element): boolean {
  const selection = block.ownerDocument.getSelection?.()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false
  const node = selection.anchorNode
  return node != null && (node === block || block.contains(node))
}

/** Blocks of one message that may be cut, in order. */
export function blocksOf(flow: Element): Element[] {
  return Array.from(flow.querySelectorAll(BLOCKS)).filter((block) => {
    const zone = block.parentElement?.closest(PLAIN_ZONE)
    return !(zone && flow.contains(zone)) && block.closest(`.${CLONE}`) === null
  })
}

let painting = false

function syncFlow(flow: Element, now: number): void {
  let budget = FLOW_BUDGET
  for (const block of blocksOf(flow)) {
    const text = sourceText(block)
    const count = letterCount(text)
    if (count === 0) continue
    const fits = count <= BLOCK_MAX && count <= budget
    if (!fits) {
      if (block.hasAttribute(MARK) || block.hasAttribute(PENDING)) unpaintBlock(block)
      if (count > BLOCK_MAX) continue
      budget = 0
      continue
    }
    budget -= count
    if (block.hasAttribute(MARK) && block.getAttribute(MARK) === text) continue
    if (selectionInside(block)) continue
    if (block.hasAttribute(MARK)) unpaintBlock(block)
    // Streaming text shows plain; it is cut once it has sat still.
    if (block.getAttribute(PENDING) !== text) {
      block.setAttribute(PENDING, text)
      block.setAttribute(STABLE, String(now))
      continue
    }
    if (now - Number(block.getAttribute(STABLE) || 0) < SETTLE_MS) continue
    block.removeAttribute(PENDING)
    block.removeAttribute(STABLE)
    block.appendChild(buildClone(block.ownerDocument, block, text))
    block.setAttribute(MARK, text)
  }
}

export function restoreMessages(documentRef: Document): void {
  for (const block of Array.from(documentRef.querySelectorAll(`[${MARK}], [${PENDING}]`))) unpaintBlock(block)
}

export function syncMessageCollage(documentRef: Document, mode: LetterMode, now = Date.now()): void {
  if (painting) return
  painting = true
  try {
    documentRef.documentElement.setAttribute(MODE_ATTR, mode)
    if (mode !== 'collage') {
      restoreMessages(documentRef)
      return
    }
    const flows = Array.from(documentRef.querySelectorAll(FLOWS))
    const cut = flows.slice(-MAX_FLOWS)
    for (const flow of flows.slice(0, Math.max(0, flows.length - MAX_FLOWS))) {
      for (const block of Array.from(flow.querySelectorAll(`[${MARK}], [${PENDING}]`))) unpaintBlock(block)
    }
    for (const flow of cut) syncFlow(flow, now)
  } finally {
    painting = false
  }
}

/** True when some block is waiting to settle, so the caller can schedule another pass. */
export function hasPending(documentRef: Document): boolean {
  return documentRef.querySelector(`[${PENDING}]`) !== null
}

export function clearMode(documentRef: Document): void {
  restoreMessages(documentRef)
  documentRef.documentElement.removeAttribute(MODE_ATTR)
}
