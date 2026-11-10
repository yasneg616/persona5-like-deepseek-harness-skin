/**
 * Comic sound-effect burst. A red star with one short onomatopoeia pops when
 * the live transcript grows: a sent prompt, a tool call, a new reply step.
 *
 * Flash safety: one burst per second at most, about 1.1s long, never on the
 * first paint or a session switch, and skipped under reduced motion.
 */
export interface FlowCounts {
  user: number
  tool: number
  assistant: number
}

export type BurstKind = keyof FlowCounts

export const SFX_WORDS: Record<BurstKind, string> = {
  user: '咚!',
  tool: '咔!',
  assistant: '唰!',
}

export const BURST_MS = 1100
export const BURST_GAP_MS = 1000

export function countFlows(documentRef: Document): FlowCounts {
  return {
    user: documentRef.querySelectorAll('[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]').length,
    tool: documentRef.querySelectorAll('[data-chat-flow-kind="tool-call"]').length,
    assistant: documentRef.querySelectorAll('[data-chat-flow-kind="assistant-step"]').length,
  }
}

/** Which burst a growth step earns. Tool calls beat prompts, prompts beat replies. */
export function burstFor(previous: FlowCounts, next: FlowCounts): BurstKind | null {
  if (next.tool > previous.tool) return 'tool'
  if (next.user > previous.user) return 'user'
  if (next.assistant > previous.assistant) return 'assistant'
  return null
}

export interface BurstHandle {
  root: HTMLElement
  pop(kind: BurstKind, now?: number): boolean
  dispose(): void
}

export function createBurst(documentRef: Document, windowRef: Window): BurstHandle {
  const root = documentRef.createElement('div')
  root.className = 'dsh-cc-sfx'
  root.setAttribute('aria-hidden', 'true')
  const word = documentRef.createElement('b')
  root.append(word)
  let last = Number.NEGATIVE_INFINITY
  let timer = 0
  return {
    root,
    pop(kind, now = Date.now()) {
      if (windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
      if (now - last < BURST_GAP_MS) return false
      last = now
      word.textContent = SFX_WORDS[kind]
      root.setAttribute('data-cc-kind', kind)
      root.classList.remove('is-on')
      void root.offsetWidth
      root.classList.add('is-on')
      windowRef.clearTimeout(timer)
      timer = windowRef.setTimeout(() => root.classList.remove('is-on'), BURST_MS + 60)
      return true
    },
    dispose() {
      windowRef.clearTimeout(timer)
      root.remove()
    },
  }
}
