export interface ViewSignals {
  /** Text of the sidebar control with aria-current="page". */
  panelLabel: string | null
  /** Two-digit number the skin gave that control, when it is a paper leaf. */
  panelNumber?: string | null
  /** Text inside the conversation header. */
  headerLabel: string | null
  /** Text of the selected session row. */
  sessionLabel: string | null
  /** Conversation phase. `hero` is the blank landing. */
  phase?: string | null
}

export interface ArchitectureLabel {
  /** Fixed brand. Panel and session names do not replace it. */
  text: string
  lines: readonly ['DEEPSEEK', 'HARNESS']
  mode: 'cutout'
  /** Page name, shown on the caption box of the main sheet. Empty on the landing. */
  state: string | null
}

/** Caption box on the main sheet: number, real page name, heist kicker. */
export interface SectionCaption {
  no: string
  title: string
  kicker: string
  local: string
}

const PRODUCT_TITLES = new Set(['deepseek harness', 'dsh'])

export const BRAND_LINES = ['DEEPSEEK', 'HARNESS'] as const

/**
 * The upper-left mark is the fixed two-line brand. The active panel lives on
 * the caption box, so opening Plugins does not replace the word.
 * `document.title` is not an input: on 0.2.2-rc.1 it stayed "DeepSeek Harness"
 * while the Plugins panel was current.
 */
export function resolveArchitectureLabel(signals: ViewSignals): ArchitectureLabel {
  return {
    text: 'DEEPSEEK',
    lines: BRAND_LINES,
    mode: 'cutout',
    state: pageState(signals),
  }
}

/**
 * Heist names wrap the real label; they never replace it.
 * Blank landing = a fresh calling card. A session = the infiltration in
 * progress. Any other panel = the hideout.
 */
export function resolveSection(signals: ViewSignals): SectionCaption {
  if (signals.phase === 'hero') return { no: '00', title: '新预告信', kicker: 'CALLING CARD', local: '新会话' }
  const panel = clean(signals.panelLabel)
  const header = clean(signals.headerLabel)
  // A session row can stay selected while a panel is open; only an open
  // conversation header means the session is on screen.
  if (panel && !header) {
    return { no: signals.panelNumber || '01', title: short(panel), kicker: 'HIDEOUT', local: '据点' }
  }
  const session = firstMeaningful(signals.headerLabel, signals.sessionLabel)
  if (session) return { no: '01', title: short(session), kicker: 'INFILTRATION', local: '潜入中' }
  return { no: '01', title: 'SESSION', kicker: 'INFILTRATION', local: '潜入中' }
}

function short(text: string): string {
  const chars = [...text]
  return chars.length > 28 ? `${chars.slice(0, 27).join('')}…` : text
}

function pageState(signals: ViewSignals): string | null {
  if (signals.phase === 'hero') return null
  const raw = firstMeaningful(signals.panelLabel, signals.headerLabel, signals.sessionLabel)
  if (!raw) return null
  const text = raw.slice(0, 32)
  if (/^[A-Za-z ]+$/.test(text) && text.length <= 18) return text.toUpperCase()
  return text
}

function clean(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (!trimmed || PRODUCT_TITLES.has(trimmed.toLowerCase())) return null
  return trimmed
}

function firstMeaningful(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = clean(value)
    if (trimmed) return trimmed
  }
  return null
}

export function readViewSignals(documentRef: Document): ViewSignals {
  const current = documentRef.querySelector('[aria-current="page"]')
  return {
    panelLabel: visibleText(current),
    panelNumber: current?.getAttribute('data-cc-num') ?? null,
    headerLabel: visibleText(documentRef.querySelector('[data-conversation-header-leading]')),
    sessionLabel: visibleText(documentRef.querySelector('[data-row-key^="session:"][aria-selected="true"]')),
    phase: documentRef.querySelector('[data-phase]')?.getAttribute('data-phase') ?? null,
  }
}

function visibleText(node: Element | null): string | null {
  if (!node) return null
  const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
  return text || null
}

export interface CaptionHandle {
  root: HTMLElement
  update(section: SectionCaption): void
  dispose(): void
}

/**
 * Caption box above the main sheet. Decorative: the host keeps the real
 * accessible names, so the box is aria-hidden and click-through.
 */
export function createCaption(documentRef: Document): CaptionHandle {
  const root = documentRef.createElement('div')
  root.className = 'dsh-cc-caption'
  root.setAttribute('aria-hidden', 'true')
  const no = documentRef.createElement('b')
  no.className = 'dsh-cc-caption-no'
  const body = documentRef.createElement('span')
  body.className = 'dsh-cc-caption-body'
  const kicker = documentRef.createElement('small')
  kicker.className = 'dsh-cc-caption-kicker'
  const kickerLatin = documentRef.createElement('span')
  const kickerLocal = documentRef.createElement('em')
  kicker.append(kickerLatin, kickerLocal)
  const title = documentRef.createElement('strong')
  title.className = 'dsh-cc-caption-title'
  body.append(kicker, title)
  root.append(no, body)
  const set = (node: Element, text: string) => {
    if (node.textContent !== text) node.textContent = text
  }
  return {
    root,
    update(section) {
      set(no, section.no)
      set(kickerLatin, section.kicker)
      set(kickerLocal, section.local)
      set(title, section.title)
      if (root.getAttribute('data-cc-kicker') !== section.kicker) root.setAttribute('data-cc-kicker', section.kicker)
    },
    dispose() {
      root.remove()
    },
  }
}
