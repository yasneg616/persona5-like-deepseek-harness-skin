/**
 * Calling-card window chrome for the Windows desktop shell.
 *
 * The desktop main window is frameless (`titleBarStyle: "hidden"`,
 * `titleBarOverlay: false`). Its 40px caption is web-rendered by the
 * desktop preload: an 应用 / 编辑 menubar host (`[data-windows-menu]`) and a
 * minimize / maximize / close host (`[data-industrial-caption-fallback]`).
 * The preload also exposes `window.dshDesktop.windowControls` with
 * `invoke(action)` and `menu(name, x, y)`, so a skin can draw its own caption.
 *
 * When, and only when, that API is present, this module wires our P5 buttons
 * to it and sets `html[data-cc-caption]`; the stylesheet then hides the
 * preload hosts and the 40px bar. Without the API (browser profile, macOS,
 * an older desktop build) nothing is hidden and the host caption stays.
 * Dispose removes the attribute, so the preload caption comes back.
 */
export const CAPTION_ATTR = 'data-cc-caption'

export type WindowAction = 'state' | 'minimize' | 'maximize' | 'restore' | 'close'
export interface WindowState { maximized?: boolean, minimized?: boolean, closed?: boolean }
export interface WindowControls {
  invoke(action: WindowAction): Promise<WindowState | undefined>
  menu(name: 'application' | 'edit', x: number, y: number): Promise<unknown>
}

/** The desktop preload's caption API, or null when this is not the Windows desktop shell. */
export function windowControls(windowRef: Window): WindowControls | null {
  try {
    const api = (windowRef as unknown as { dshDesktop?: { windowControls?: Partial<WindowControls> } }).dshDesktop?.windowControls
    if (api && typeof api.invoke === 'function' && typeof api.menu === 'function') return api as WindowControls
  } catch {
    // A locked-down bridge: keep the host caption.
  }
  return null
}

const LABELS = {
  zh: { minimize: '最小化', maximize: '最大化', restore: '还原', close: '关闭', application: '应用', edit: '编辑', bar: '菜单栏' },
  en: { minimize: 'Minimize', maximize: 'Maximize', restore: 'Restore', close: 'Close', application: 'Application', edit: 'Edit', bar: 'Menu bar' },
}

export function chromeLabels(lang: string) {
  return lang.toLowerCase().startsWith('zh') ? LABELS.zh : LABELS.en
}

/** Host menubar labels follow the app language; reuse them when the preload host is there. */
function hostMenuLabels(documentRef: Document): string[] {
  const host = documentRef.querySelector('[data-windows-menu]')
  const buttons = host?.shadowRoot?.querySelectorAll('button')
  return buttons ? Array.from(buttons).map((button) => (button.textContent || '').trim()) : []
}

export interface Chrome {
  /** True when our caption replaced the host one. */
  readonly on: boolean
  /** Refresh labels (language) and the maximize glyph. */
  sync(): void
  dispose(): void
}

export function mountChrome(documentRef: Document, windowRef: Window, root: HTMLElement | null): Chrome {
  const api = windowControls(windowRef)
  if (!api || !root) return { on: false, sync() {}, dispose() {} }
  const html = documentRef.documentElement
  const menus = Array.from(root.querySelectorAll<HTMLButtonElement>('.dsh-cc-menu'))
  const wins = Array.from(root.querySelectorAll<HTMLButtonElement>('.dsh-cc-win'))
  const maximize = root.querySelector<HTMLButtonElement>('.dsh-cc-win[data-win="maximize"]')
  let disposed = false
  let maximized = false

  const sync = () => {
    const labels = chromeLabels(html.lang || 'zh')
    const host = hostMenuLabels(documentRef)
    menus.forEach((button, index) => {
      const name = button.getAttribute('data-menu') === 'edit' ? 'edit' : 'application'
      const text = host[index] || labels[name]
      const label = button.querySelector('.dsh-cc-menu-label')
      if (label && label.textContent !== text) label.textContent = text
    })
    root.querySelector('.dsh-cc-menus')?.setAttribute('aria-label', labels.bar)
    for (const button of wins) {
      const action = button.getAttribute('data-win') as 'minimize' | 'maximize' | 'close'
      const text = action === 'maximize' && maximized ? labels.restore : labels[action]
      if (button.getAttribute('aria-label') !== text) {
        button.setAttribute('aria-label', text)
        button.setAttribute('title', text)
      }
    }
    maximize?.toggleAttribute('data-cc-max', maximized)
  }

  const apply = (state: WindowState | undefined) => {
    if (disposed || !state || state.closed) return
    maximized = state.maximized === true
    sync()
  }
  const refresh = () => {
    api.invoke('state').then(apply, () => {})
  }

  const onWin = (event: Event) => {
    const named = (event.currentTarget as HTMLElement).getAttribute('data-win') as WindowAction
    const action: WindowAction = named === 'maximize' && maximized ? 'restore' : named
    api.invoke(action).then(apply, (error) => console.error('calling-card caption:', error))
  }
  for (const button of wins) button.addEventListener('click', onWin)

  // Menus open a native popup under the tab. Like the host menubar, they never take focus from the editor.
  const keep = (event: Event) => event.preventDefault()
  const open = async (button: HTMLButtonElement) => {
    if (button.getAttribute('aria-expanded') === 'true') return
    const name = button.getAttribute('data-menu') === 'edit' ? 'edit' : 'application'
    const rect = button.getBoundingClientRect()
    button.setAttribute('aria-expanded', 'true')
    try {
      await api.menu(name, Math.max(0, rect.left), Math.max(0, rect.bottom))
    } catch (error) {
      console.error('calling-card menu:', error)
    } finally {
      button.setAttribute('aria-expanded', 'false')
    }
  }
  const onMenu = (event: Event) => {
    void open(event.currentTarget as HTMLButtonElement)
  }
  const onMenuKey = (event: KeyboardEvent) => {
    const button = event.currentTarget as HTMLButtonElement
    const index = menus.indexOf(button)
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const next = menus[(index + (event.key === 'ArrowRight' ? 1 : menus.length - 1)) % menus.length]
      button.tabIndex = -1
      next.tabIndex = 0
      next.focus()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      void open(button)
    }
  }
  menus.forEach((button, index) => {
    button.tabIndex = index === 0 ? 0 : -1
    button.addEventListener('pointerdown', keep)
    button.addEventListener('mousedown', keep)
    button.addEventListener('click', onMenu)
    button.addEventListener('keydown', onMenuKey)
  })

  let resizeTimer = 0
  const onResize = () => {
    windowRef.clearTimeout(resizeTimer)
    resizeTimer = windowRef.setTimeout(refresh, 120)
  }
  windowRef.addEventListener('resize', onResize)

  root.setAttribute('data-on', '')
  html.setAttribute(CAPTION_ATTR, '')
  sync()
  refresh()

  return {
    on: true,
    sync,
    dispose() {
      disposed = true
      windowRef.clearTimeout(resizeTimer)
      windowRef.removeEventListener('resize', onResize)
      for (const button of wins) button.removeEventListener('click', onWin)
      for (const button of menus) {
        button.removeEventListener('pointerdown', keep)
        button.removeEventListener('mousedown', keep)
        button.removeEventListener('click', onMenu)
        button.removeEventListener('keydown', onMenuKey)
      }
      root.removeAttribute('data-on')
      html.removeAttribute(CAPTION_ATTR)
    },
  }
}
