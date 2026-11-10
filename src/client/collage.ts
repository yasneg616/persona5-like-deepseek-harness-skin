/**
 * Ransom-note letters for the blank-session headline only.
 *
 * Readable mode: paragraphs, lists, tables, code and streamed headings are
 * never cut. The only cut-out type on screen is the DEEPSEEK / HARNESS word
 * (overlay) and the welcome headline (this module), so the page keeps at
 * most two ransom elements.
 */
const SOURCE = 'data-cc-source'
const PENDING = 'data-cc-pending'
const STABLE = 'data-cc-stable'
const MARK = 'data-cc-cut'
const HAN = 'dsh-cc-han'

/** Welcome titles such as "Into the Unknown" fit. Anything longer stays plain. */
export const TITLE_CUT_MAX = 24
export const SETTLE_MS = 500

const LATIN_FACES = ['Anton', 'ArchivoBlack', 'AbrilFatface'] as const
const CJK_FACES = ['CcSans', 'CcSerif', 'CcDisplay'] as const

const BLOCK = 'pre, code, kbd, samp, math, svg, table, textarea, input, button, [contenteditable="true"], [data-composer-card], [data-composer-input], .katex, mjx-container'

const TARGETS = '[data-cc-hero-title]'

export interface Piece {
  text: string
  kind: 'plain' | 'letter'
  face?: string
  tone?: string
}

let painting = false

function cjkChar(character: string): boolean {
  return /[\u3400-\u9fff]/.test(character)
}

function faceFor(character: string, index: number): string {
  const list = cjkChar(character) ? CJK_FACES : LATIN_FACES
  return list[index % list.length]
}

export function piecesFor(text: string): Piece[] {
  const pieces: Piece[] = []
  let index = 0
  for (const character of text) {
    if (character.trim().length === 0) {
      pieces.push({ text: character, kind: 'plain' })
      continue
    }
    pieces.push({
      text: character,
      kind: 'letter',
      face: faceFor(character, index),
      tone: String((index * 7) % 4),
    })
    index += 1
  }
  return pieces
}

function blocked(block: Element): boolean {
  return block.closest(BLOCK) !== null
}

function cuttable(text: string): boolean {
  const chars = [...text].filter((character) => character.trim().length > 0)
  return chars.length >= 2 && chars.length <= TITLE_CUT_MAX
}

function selectionInside(block: Element): boolean {
  const selection = block.ownerDocument.getSelection?.()
  if (!selection || selection.rangeCount === 0) return false
  const node = selection.anchorNode
  return node != null && (node === block || block.contains(node))
}

function fragmentFor(documentRef: Document, pieces: Piece[]): DocumentFragment {
  const fragment = documentRef.createDocumentFragment()
  let word: HTMLElement | null = null
  for (const piece of pieces) {
    if (piece.kind === 'plain') {
      word = null
      fragment.append(documentRef.createTextNode(piece.text))
      continue
    }
    if (!word) {
      word = documentRef.createElement('span')
      word.className = 'dsh-cc-word'
      fragment.append(word)
    }
    const span = documentRef.createElement('span')
    span.className = HAN
    span.setAttribute('data-cc-face', piece.face ?? '')
    span.setAttribute('data-cc-han', piece.tone ?? '0')
    span.textContent = piece.text
    word.append(span)
  }
  return fragment
}

function painted(block: Element): boolean {
  return block.querySelector(`.${HAN}`) !== null
}

function paintElement(block: Element): void {
  const text = block.textContent ?? ''
  for (const node of Array.from(block.childNodes)) {
    if (node.nodeType === 3) {
      block.replaceChild(fragmentFor(block.ownerDocument, piecesFor(node.textContent ?? '')), node)
      continue
    }
    if (node.nodeType !== 1) continue
    const element = node as Element
    if (element.matches(BLOCK) || element.matches('a[href]')) continue
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 3) element.replaceChild(fragmentFor(block.ownerDocument, piecesFor(child.textContent ?? '')), child)
    }
  }
  block.setAttribute(SOURCE, text)
  block.setAttribute('aria-label', text.replace(/\s+/g, ' ').trim())
  block.removeAttribute(PENDING)
  block.removeAttribute(STABLE)
  block.setAttribute(MARK, '')
}

export function restoreBlock(block: Element): void {
  if (painted(block)) block.textContent = block.textContent ?? ''
  if (block.hasAttribute(SOURCE)) block.removeAttribute('aria-label')
  block.removeAttribute(SOURCE)
  block.removeAttribute(PENDING)
  block.removeAttribute(STABLE)
  block.removeAttribute(MARK)
}

function syncBlock(block: Element, now: number): void {
  if (blocked(block) || selectionInside(block)) return
  const text = block.textContent ?? ''
  const saved = block.getAttribute(SOURCE)
  if (saved === text && painted(block)) return
  if (saved != null) restoreBlock(block)
  if (!cuttable(text)) return
  // Wait until the host stops rewriting the headline before cutting it.
  if (block.getAttribute(PENDING) !== text) {
    block.setAttribute(PENDING, text)
    block.setAttribute(STABLE, String(now))
    return
  }
  if (now - Number(block.getAttribute(STABLE) || 0) < SETTLE_MS) return
  paintElement(block)
}

export function syncCollage(documentRef: Document, now = Date.now()): void {
  if (painting) return
  painting = true
  try {
    for (const block of Array.from(documentRef.querySelectorAll(TARGETS))) syncBlock(block, now)
  } finally {
    painting = false
  }
}

export function restoreCollage(documentRef: Document): void {
  for (const node of Array.from(documentRef.querySelectorAll(`[${SOURCE}], [${PENDING}], [${MARK}]`))) {
    restoreBlock(node)
  }
}
