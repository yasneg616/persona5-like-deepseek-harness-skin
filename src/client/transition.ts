import { cutoutFor } from './cutouts.ts'
import { escapeBelongsToHost } from './escape.ts'

export interface TransitionHandle {
  root: HTMLElement
  play(label: string, durationMs: number, kicker?: string): void
  cancel(): void
  dispose(): void
}

const NAV_MS = 600
const REPLAY_MS = 1050

/** Short Latin labels are cut per letter; Chinese and long titles stay one stamp. */
export function cutsAsLetters(label: string): boolean {
  return /^[A-Z][A-Z ]{1,13}$/.test(label) && label.replace(/ /g, '').length <= 12
}

export function prefersReducedMotion(windowRef: Window): boolean {
  return windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function paintTitle(documentRef: Document, title: HTMLElement, text: string): void {
  title.replaceChildren()
  title.removeAttribute('data-cc-letters')
  if (!cutsAsLetters(text)) {
    title.textContent = text
    return
  }
  title.setAttribute('data-cc-letters', '')
  for (const word of text.split(' ').filter(Boolean)) {
    const line = documentRef.createElement('span')
    line.className = 'dsh-cc-line'
    for (const letter of cutoutFor(word)) {
      const tile = documentRef.createElement('span')
      tile.className = `dsh-cc-letter dsh-cc-shape-${letter.shape}${letter.reverse ? ' is-reversed' : ''}`
      tile.style.setProperty('--slot', `${letter.w}em`)
      tile.style.setProperty('--face', letter.face)
      tile.style.setProperty('--letter-size', `${letter.size}em`)
      tile.style.setProperty('--letter-x', String(letter.sx))
      tile.style.setProperty('--tilt', `${letter.rot}deg`)
      tile.style.setProperty('--lift', `${letter.y}em`)
      tile.style.setProperty('--paper-height', `${letter.h}em`)
      const glyph = documentRef.createElement('span')
      glyph.className = 'dsh-cc-glyph'
      glyph.textContent = letter.c
      tile.append(glyph)
      line.append(tile)
    }
    title.append(line)
  }
}

export function createTransitionLayer(documentRef: Document, windowRef: Window): TransitionHandle {
  const root = documentRef.createElement('div')
  root.className = 'dsh-cc-transition'
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML = [
    '<div class="dsh-cc-cut"></div>',
    '<div class="dsh-cc-cover"></div>',
    '<div class="dsh-cc-band"></div>',
    '<div class="dsh-cc-rail"></div>',
    '<div class="dsh-cc-motion"><small class="dsh-cc-motion-kicker"></small><strong class="dsh-cc-motion-title"></strong><i>TAKE YOUR TIME.</i></div>',
  ].join('')
  const kickerNode = root.querySelector('.dsh-cc-motion-kicker') as HTMLElement
  const title = root.querySelector('.dsh-cc-motion-title') as HTMLElement
  let timer = 0
  let playing = false

  const finish = () => {
    windowRef.clearTimeout(timer)
    timer = 0
    playing = false
    root.classList.remove('is-on')
    root.removeAttribute('data-cc-playing')
  }

  const play = (label: string, durationMs: number, kicker = 'NAV') => {
    const text = label.trim() || 'DEEPSEEK'
    kickerNode.textContent = kicker
    title.setAttribute('aria-label', text)
    paintTitle(documentRef, title, text)
    if (prefersReducedMotion(windowRef)) {
      finish()
      return
    }
    playing = true
    root.setAttribute('data-cc-playing', '')
    root.style.setProperty('--dsh-cc-duration', `${durationMs}ms`)
    root.classList.remove('is-on')
    // Restart the paper cut from the latest navigation target.
    void root.offsetWidth
    root.classList.add('is-on')
    windowRef.clearTimeout(timer)
    timer = windowRef.setTimeout(finish, durationMs + 40)
  }

  const onKey = (event: KeyboardEvent) => {
    if (!playing || event.key !== 'Escape') return
    if (escapeBelongsToHost(event.target)) return
    finish()
  }
  documentRef.addEventListener('keydown', onKey)

  return {
    root,
    play,
    cancel: finish,
    dispose() {
      finish()
      documentRef.removeEventListener('keydown', onKey)
      root.remove()
    },
  }
}

export const NAV_DURATION_MS = NAV_MS
export const REPLAY_DURATION_MS = REPLAY_MS
