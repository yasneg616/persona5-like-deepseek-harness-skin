import type { SectionCaption } from './title.ts'

/**
 * Giant cropped title behind the sheet: the section word set huge and
 * tilted, cropped by the screen edge and by the sheet in front of it.
 * Decorative only (aria-hidden, no pointer). It slams in again when the
 * section changes, never on the first fill.
 */
export interface GiantTitle {
  root: HTMLElement
  update(section: SectionCaption): void
  dispose(): void
}

/** The word the giant shows: real English panel names, else the heist name. */
export function giantWord(section: SectionCaption): string {
  if (section.kicker === 'HIDEOUT' && /^[A-Za-z][A-Za-z ]{0,17}$/.test(section.title)) return section.title.toUpperCase()
  return section.kicker
}

export function createGiant(documentRef: Document): GiantTitle {
  const root = documentRef.createElement('div')
  root.className = 'dsh-cc-giant'
  root.setAttribute('aria-hidden', 'true')
  const word = documentRef.createElement('b')
  root.append(word)
  let last = ''
  return {
    root,
    update(section) {
      const next = giantWord(section)
      if (next === last) return
      const first = last === ''
      last = next
      word.textContent = next
      root.setAttribute('data-cc-text', next)
      if (first) return
      root.classList.remove('is-slam')
      void root.offsetWidth
      root.classList.add('is-slam')
    },
    dispose() {
      root.remove()
    },
  }
}
