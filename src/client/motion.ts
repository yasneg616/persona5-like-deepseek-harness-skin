/**
 * One-time entry motion for newly inserted UI.
 *
 * A node is tagged with `data-cc-enter` the first time the skin sees it and
 * the tag comes off when its entry animation ends (or after a fallback
 * timeout), so settled content never moves again and long transcripts only
 * pay for the few nodes that just arrived. Transcript papers are tagged only
 * when the caller says the transcript grew in place: never on first paint or
 * a session switch. Nothing is tagged under reduced motion.
 */
export const ENTER = 'data-cc-enter'
export const STAGGER = '--cc-stagger'
export const ENTER_MAX_MS = 1400
/** Rows past this many in one pass arrive without motion, so a long list does not stall. */
export const ROW_BURST_CAP = 14

const LEAF = '[data-cc-leaf]'
const ROW = '[data-row-key^="session:"], [data-row-key^="workspace:"]'
const FLOW = '[data-chat-flow-kind]'

export interface EntryOptions {
  /** Tag transcript papers that are new since the last pass. */
  flows: boolean
  /** Replay the sidebar leaf slam (phase change). */
  replayLeaves?: boolean
  now?: number
}

export interface EntryTracker {
  sync(options: EntryOptions): number
  clear(): void
  dispose(): void
}

export function createEntryTracker(documentRef: Document, windowRef: Window): EntryTracker {
  const seen = new WeakSet<Element>()
  const tagged = new Map<Element, number>()
  let flowSide = 0
  let sweep = 0

  const untag = (node: Element) => {
    node.removeAttribute(ENTER)
    ;(node as HTMLElement).style?.removeProperty(STAGGER)
    tagged.delete(node)
  }

  const onEnd = (event: Event) => {
    const node = event.target as Element | null
    const name = (event as AnimationEvent).animationName || ''
    if (!node || !tagged.has(node) || !name.startsWith('dsh-cc-in-')) return
    untag(node)
  }
  documentRef.addEventListener('animationend', onEnd, true)
  documentRef.addEventListener('animationcancel', onEnd, true)

  const tag = (node: Element, value: string, index: number, now: number) => {
    node.setAttribute(ENTER, value)
    ;(node as HTMLElement).style?.setProperty(STAGGER, String(index))
    tagged.set(node, now)
  }

  const reduced = () => windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches

  return {
    sync({ flows, replayLeaves = false, now = Date.now() }) {
      for (const [node, at] of tagged) {
        if (now - at > ENTER_MAX_MS || !node.isConnected) untag(node)
      }
      const still = reduced()
      let count = 0
      let leafIndex = 0
      for (const leaf of Array.from(documentRef.querySelectorAll(LEAF))) {
        const fresh = !seen.has(leaf)
        seen.add(leaf)
        if (still || !(fresh || replayLeaves)) continue
        tag(leaf, 'leaf', leafIndex++, now)
        count += 1
      }
      let rowIndex = 0
      for (const row of Array.from(documentRef.querySelectorAll(ROW))) {
        if (seen.has(row)) continue
        seen.add(row)
        if (still || rowIndex >= ROW_BURST_CAP) continue
        tag(row, 'row', rowIndex++, now)
        count += 1
      }
      for (const flow of Array.from(documentRef.querySelectorAll(FLOW))) {
        if (seen.has(flow)) continue
        seen.add(flow)
        if (still || !flows) continue
        tag(flow, flowSide % 2 === 0 ? 'l' : 'r', 0, now)
        flowSide += 1
        count += 1
      }
      if (count > 0) {
        windowRef.clearTimeout(sweep)
        const batch = now
        // Fallback when animationend never fires (hidden tab, display:none).
        sweep = windowRef.setTimeout(() => {
          for (const [node, at] of Array.from(tagged)) if (at <= batch) untag(node)
        }, ENTER_MAX_MS)
      }
      return count
    },
    clear() {
      for (const node of Array.from(tagged.keys())) untag(node)
      for (const node of Array.from(documentRef.querySelectorAll(`[${ENTER}]`))) untag(node)
    },
    dispose() {
      windowRef.clearTimeout(sweep)
      this.clear()
      documentRef.removeEventListener('animationend', onEnd, true)
      documentRef.removeEventListener('animationcancel', onEnd, true)
    },
  }
}
