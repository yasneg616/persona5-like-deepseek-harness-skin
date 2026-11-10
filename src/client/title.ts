export interface ViewSignals {
  /** Text of the sidebar control with aria-current="page". */
  panelLabel: string | null
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
  /** Page name, shown as a small secondary chip. Empty on the landing. */
  state: string | null
}

const PRODUCT_TITLES = new Set(['deepseek harness', 'dsh'])

export const BRAND_LINES = ['DEEPSEEK', 'HARNESS'] as const

/**
 * The upper-left mark is the fixed two-line brand. The active panel is only
 * a secondary chip, so opening Plugins does not replace the word.
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

function pageState(signals: ViewSignals): string | null {
  if (signals.phase === 'hero') return null
  const raw = firstMeaningful(signals.panelLabel, signals.headerLabel, signals.sessionLabel)
  if (!raw) return null
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, 32)
  if (/^[A-Za-z ]+$/.test(text) && text.length <= 18) return text.toUpperCase()
  return text
}

function firstMeaningful(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue
    const trimmed = value.replace(/\s+/g, ' ').trim()
    if (!trimmed) continue
    if (PRODUCT_TITLES.has(trimmed.toLowerCase())) continue
    return trimmed
  }
  return null
}

export function readViewSignals(documentRef: Document): ViewSignals {
  return {
    panelLabel: visibleText(documentRef.querySelector('[aria-current="page"]')),
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
