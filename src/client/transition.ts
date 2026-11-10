import { escapeBelongsToHost } from './escape.ts'

export interface TransitionHandle {
  root: HTMLElement
  play(label: string, durationMs: number): void
  cancel(): void
  dispose(): void
}

const NAV_MS = 600
const REPLAY_MS = 1050

export function prefersReducedMotion(windowRef: Window): boolean {
  return windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches
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
    '<div class="dsh-cc-motion"><small class="dsh-cc-motion-kicker"></small><strong class="dsh-cc-motion-title"></strong><i>CUT THE NOISE.</i></div>',
  ].join('')
  const kicker = root.querySelector('.dsh-cc-motion-kicker') as HTMLElement
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

  const play = (label: string, durationMs: number) => {
    const text = label.trim() || 'DEEPSEEK'
    kicker.textContent = 'NAV'
    title.textContent = text
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
