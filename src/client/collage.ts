const SOURCE = 'data-cc-source'
const PENDING = 'data-cc-pending'
const STABLE = 'data-cc-stable'
const MARK = 'data-cc-cut'
const RUN = 'dsh-cc-run'
const HAN = 'dsh-cc-han'
const URL_RUN = 'dsh-cc-url'

/** Welcome titles such as "Into the Unknown" fit. A longer streaming heading stays plain. */
export const TITLE_CUT_MAX = 48
export const SETTLE_MS = 500

const LATIN_FACES = ['Anton', 'ArchivoBlack', 'AbrilFatface'] as const
const CJK_FACES = ['CcSans', 'CcSerif', 'CcDisplay', 'CcBrush'] as const
const CHIPS = ['paper', 'ink', 'red'] as const

const BLOCK = 'pre, code, kbd, samp, math, svg, table, textarea, input, button, [contenteditable="true"], [data-composer-card], [data-composer-input], .katex, mjx-container'

const TARGETS = [
  '[data-cc-hero-title]',
  '[data-cc-hero-tag]',
  '[data-conversation-scroll] :is(h1, h2, h3)',
  '[data-chat-flow-kind="assistant-step"] :is(h1, h2, h3, p, li, blockquote)',
].join(', ')

interface Piece {
  text: string
  kind: 'plain' | 'url' | 'run' | 'letter'
  face?: string
  chip?: string
  tone?: string
  /** This piece starts a new word, so it needs a visible gap before it. */
  gap?: boolean
}

let painting = false

function cjkChar(character: string): boolean {
  return /[\u3400-\u9fff]/.test(character)
}

function faceFor(character: string, index: number): string {
  const list = cjkChar(character) ? CJK_FACES : LATIN_FACES
  return list[index % list.length]
}

export function piecesFor(text: string, mode: 'letters' | 'runs'): Piece[] {
  if (mode === 'letters') {
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
        tone: String(index % 4),
      })
      index += 1
    }
    return pieces
  }
  const pieces: Piece[] = []
  const pattern = /(https?:\/\/[^\s]+)|(\s+)|([\u3400-\u9fff]+)|([A-Za-z0-9]+(?:['’][A-Za-z]+)?)|([^\s])/gu
  let runIndex = 0
  let afterSpace = false
  for (const match of text.matchAll(pattern)) {
    const [token, url, space, cjk, word] = match
    if (url) {
      pieces.push({ text: url, kind: 'url', gap: afterSpace })
      afterSpace = false
      continue
    }
    if (space || (!cjk && !word)) {
      pieces.push({ text: token, kind: 'plain' })
      afterSpace = Boolean(space)
      continue
    }
    const chunks = cjk ? chunk(cjk, 2) : [word ?? token]
    chunks.forEach((chunkText, chunkIndex) => {
      const chip = CHIPS[runIndex % CHIPS.length]
      pieces.push({
        text: chunkText,
        kind: 'run',
        face: faceFor(chunkText, runIndex),
        chip,
        gap: afterSpace && chunkIndex === 0,
      })
      runIndex += 1
    })
    afterSpace = false
  }
  return pieces
}

function chunk(text: string, size: number): string[] {
  const chars = [...text]
  const parts: string[] = []
  for (let i = 0; i < chars.length; i += size) parts.push(chars.slice(i, i + size).join(''))
  return parts
}

function modeOf(block: Element): 'letters' | 'runs' {
  return block.matches('h1, h2, h3, [data-cc-hero-title], [data-cc-hero-tag]') ? 'letters' : 'runs'
}

function blocked(block: Element): boolean {
  return block.closest(BLOCK) !== null
}

function tooLong(block: Element, text: string): boolean {
  if (modeOf(block) !== 'letters') return false
  const chars = [...text].filter((character) => character.trim().length > 0)
  return chars.length < 2 || chars.length > TITLE_CUT_MAX
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
  const flush = () => {
    if (!word) return
    fragment.append(word)
    word = null
  }
  for (const piece of pieces) {
    if (piece.kind !== 'letter') flush()
    if (piece.kind === 'plain') {
      fragment.append(documentRef.createTextNode(piece.text))
      continue
    }
    const span = documentRef.createElement('span')
    if (piece.kind === 'url') span.className = URL_RUN
    else if (piece.kind === 'letter') {
      span.className = HAN
      span.setAttribute('data-cc-face', piece.face ?? '')
      span.setAttribute('data-cc-han', piece.tone ?? '0')
      if (!word) {
        word = documentRef.createElement('span')
        word.className = 'dsh-cc-word'
      }
      word.append(span)
    } else {
      span.className = RUN
      span.setAttribute('data-cc-face', piece.face ?? '')
      if (piece.chip) span.setAttribute('data-cc-chip', piece.chip)
      if (piece.gap) span.setAttribute('data-cc-gap', '')
    }
    span.textContent = piece.text
    if (piece.kind !== 'letter') fragment.append(span)
  }
  flush()
  return fragment
}

function paintTextNode(node: Text, mode: 'letters' | 'runs'): void {
  const text = node.textContent ?? ''
  if (text.length === 0) return
  const parent = node.parentNode
  if (!parent) return
  parent.replaceChild(fragmentFor(node.ownerDocument, piecesFor(text, mode)), node)
}

function paintElement(block: Element): void {
  const mode = modeOf(block)
  const nodes = [...block.childNodes]
  for (const node of nodes) {
    if (node.nodeType === 3) {
      paintTextNode(node as Text, mode)
      continue
    }
    if (node.nodeType !== 1) continue
    const element = node as Element
    if (element.classList.contains(RUN) || element.classList.contains(HAN) || element.classList.contains(URL_RUN)) continue
    if (element.matches(BLOCK) || element.matches('a[href]')) continue
    const inner = [...element.childNodes]
    for (const child of inner) {
      if (child.nodeType === 3) paintTextNode(child as Text, mode)
    }
  }
  block.setAttribute(SOURCE, block.textContent ?? '')
  block.removeAttribute(PENDING)
  block.removeAttribute(STABLE)
  if (mode === 'letters') block.setAttribute(MARK, '')
}

export function restoreBlock(block: Element): void {
  if (block.querySelector(`.${RUN}, .${HAN}, .${URL_RUN}`)) {
    const text = block.textContent ?? ''
    block.textContent = text
  }
  block.removeAttribute(SOURCE)
  block.removeAttribute(PENDING)
  block.removeAttribute(STABLE)
  block.removeAttribute(MARK)
}

function boundary(block: Element, count: number): Text | null {
  const documentRef = block.ownerDocument
  const walker = documentRef.createTreeWalker(block, 4)
  let seen = 0
  let node = walker.nextNode() as Text | null
  while (node) {
    const length = node.textContent?.length ?? 0
    if (seen + length > count) {
      const parent = node.parentElement
      if (parent && parent !== block && parent.closest(`.${RUN}, .${HAN}, .${URL_RUN}`)) return null
      if (seen === count) return node
      return null
    }
    seen += length
    if (seen === count) {
      const next = walker.nextNode() as Text | null
      if (!next) return null
      const parent = next.parentElement
      if (parent && parent.closest(`.${RUN}, .${HAN}, .${URL_RUN}`)) return null
      return next
    }
    node = walker.nextNode() as Text | null
  }
  return null
}

function wait(block: Element, text: string, now: number): void {
  if (block.getAttribute(PENDING) !== text) {
    block.setAttribute(PENDING, text)
    block.setAttribute(STABLE, String(now))
    return
  }
  if (now - Number(block.getAttribute(STABLE) || 0) < SETTLE_MS) return
  if (tooLong(block, text)) {
    block.removeAttribute(PENDING)
    block.removeAttribute(STABLE)
    return
  }
  paintElement(block)
}

function painted(block: Element): boolean {
  return block.querySelector(`.${RUN}, .${HAN}, .${URL_RUN}`) !== null
}

function syncBlock(block: Element, now: number): void {
  if (blocked(block) || selectionInside(block)) return
  const text = block.textContent ?? ''
  const saved = block.getAttribute(SOURCE)
  const hero = block.matches('[data-cc-hero-title], [data-cc-hero-tag]')
  if (saved === text && painted(block)) return
  if (hero && !tooLong(block, text)) {
    paintElement(block)
    return
  }
  if (saved === text) return
  if (saved != null && text.startsWith(saved) && block.querySelector(`.${RUN}, .${HAN}, .${URL_RUN}`)) {
    if (block.getAttribute(PENDING) !== text) {
      block.setAttribute(PENDING, text)
      block.setAttribute(STABLE, String(now))
      return
    }
    if (now - Number(block.getAttribute(STABLE) || 0) < SETTLE_MS) return
    const tail = boundary(block, saved.length)
    if (!tail) {
      restoreBlock(block)
      wait(block, text, now)
      return
    }
    paintTextNode(tail, modeOf(block))
    block.setAttribute(SOURCE, block.textContent ?? text)
    block.removeAttribute(PENDING)
    block.removeAttribute(STABLE)
    return
  }
  if (saved != null) restoreBlock(block)
  if (text.trim().length === 0) return
  wait(block, text, now)
}

export function syncCollage(documentRef: Document, now = Date.now()): void {
  if (painting) return
  painting = true
  try {
    const seen = new Set<Element>()
    for (const block of Array.from(documentRef.querySelectorAll(TARGETS))) {
      if (seen.has(block)) continue
      seen.add(block)
      syncBlock(block, now)
    }
  } finally {
    painting = false
  }
}

export function restoreCollage(documentRef: Document): void {
  const blocks = new Set<Element>()
  for (const node of Array.from(documentRef.querySelectorAll(`[${SOURCE}], [${PENDING}], [${MARK}]`))) {
    blocks.add(node)
  }
  for (const block of blocks) restoreBlock(block)
}
