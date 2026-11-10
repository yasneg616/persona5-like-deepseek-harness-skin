export const SKIN_ATTR = 'data-dsh-calling-card-skin'
export const STYLE_ID = 'dsh-calling-card-skin/skin.css'
export const PACKAGE_ID = 'dsh-calling-card-skin'

export function installSkinStyle(documentRef: Document, css: string): () => void {
  const root = documentRef.documentElement
  root.setAttribute(SKIN_ATTR, '')
  let tag = documentRef.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)
  if (tag === null) {
    tag = documentRef.createElement('style')
    tag.setAttribute('data-plugin', PACKAGE_ID)
    tag.setAttribute('data-plugin-css', STYLE_ID)
    tag.textContent = css
    documentRef.head.appendChild(tag)
  }
  return () => {
    root.removeAttribute(SKIN_ATTR)
    tag?.remove()
  }
}

/** Keep UA form controls on the dark calling-card ink without writing theme settings. */
export function holdDarkColorScheme(documentRef: Document): () => void {
  const html = documentRef.documentElement
  const previous = html.style.colorScheme
  const apply = () => {
    html.style.colorScheme = 'dark'
  }
  apply()
  return () => {
    html.style.colorScheme = previous
  }
}

export interface TitleWatch {
  stop(): void
}

/**
 * Fires when the host layout writes `document.title` (session and panel changes).
 * The first observed value is the current title and does not count as navigation.
 */
export function watchDocumentTitle(documentRef: Document, onNavigate: (title: string) => void): TitleWatch {
  let last = documentRef.title
  const title = documentRef.querySelector('title')
  if (title === null) return { stop() {} }
  const observer = new MutationObserver(() => {
    const next = documentRef.title
    if (next === last) return
    last = next
    onNavigate(next)
  })
  observer.observe(title, { subtree: true, childList: true, characterData: true })
  return { stop() { observer.disconnect() } }
}
