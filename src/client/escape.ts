/** Where Esc must be left to the host control that already owns it. */
export function escapeBelongsToHost(target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') return false
  const element = target as Element
  if (typeof element.closest !== 'function') return false
  if (element.closest('dialog[open], [role="dialog"], [aria-modal="true"]')) return true
  const tag = element.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ('isContentEditable' in element && (element as HTMLElement).isContentEditable) return true
  return false
}
