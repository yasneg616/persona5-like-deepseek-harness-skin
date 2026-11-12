import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'
import vm from 'node:vm'
import semver from 'semver'
import { CALLING_CARD_TOKENS, assertUnifiedTokens } from '../src/client/tokens.ts'
import { escapeBelongsToHost } from '../src/client/escape.ts'

const require = createRequire(import.meta.url)
const RANGE = '>=0.2.0-rc.2 <0.2.2-0 || 0.2.2-rc.1 || 0.2.2-rc.2'

test('calling-card tokens are one palette and use override pairs', () => {
  assertUnifiedTokens(CALLING_CARD_TOKENS)
  assert.equal(CALLING_CARD_TOKENS['--dsw-alias-brand-primary'].light, '#e60012')
  assert.equal(CALLING_CARD_TOKENS['--dsw-specific-bubble'].dark, CALLING_CARD_TOKENS['--dsw-specific-bubble'].light)
  assert.equal('--dsw-specific-sidebar-nav-item-hover' in CALLING_CARD_TOKENS, false)
  assert.equal('--dsw-alias-state-done-primary' in CALLING_CARD_TOKENS, false)
})

test('published theme bundles accept every overridden name', () => {
  const bundles = [
    require.resolve('@deepseek-ai/dsh-client-ui-theme/package.json'),
    require.resolve('dsh-theme-022/package.json'),
  ]
  const names = Object.keys(CALLING_CARD_TOKENS)
  for (const manifestPath of bundles) {
    const root = manifestPath.slice(0, -'/package.json'.length)
    const version = JSON.parse(readFileSync(manifestPath, 'utf8')).version as string
    const client = readFileSync(`${root}/lib/client.js`, 'utf8')
    const declared = new Set(client.match(/--dsw-(?:alias|specific)-[a-z0-9-]+/g) ?? [])
    const missing = names.filter((name) => !declared.has(name))
    assert.deepEqual(missing, [], `${version} missing ${missing.join(',')}`)
    const types = readFileSync(`${root}/lib/types/client/index.d.ts`, 'utf8')
    assert.match(types, /overrideTokens\(source: string, tokens: ThemeTokenOverrides\): \(\) => void/)
    assert.match(types, /light: string/)
    assert.match(types, /dark: string/)
  }
})

test('engines range matches the installed host and rejects the neighbouring cuts', () => {
  const admit = ['0.2.0-rc.2', '0.2.1-alpha.1', '0.2.1-rc.5', '0.2.2-rc.1', '0.2.2-rc.2']
  const reject = ['0.1.3-alpha.2', '0.2.0-rc.1', '0.2.2-alpha.2', '0.2.2-alpha.3', '0.3.0']
  for (const version of admit) {
    assert.equal(semver.satisfies(version, RANGE, { includePrerelease: true }), true, version)
  }
  for (const version of reject) {
    assert.equal(semver.satisfies(version, RANGE, { includePrerelease: true }), false, version)
  }
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    engines: { dsh: string }
    peerDependencies: { '@deepseek-ai/dsh': string }
  }
  assert.equal(pkg.engines.dsh, RANGE)
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh'], RANGE)
})

test('Escape stays with dialogs and editable fields', () => {
  const dom = new JSDOM('<textarea></textarea><input /><div role="dialog"></div><button></button>')
  const doc = dom.window.document
  assert.equal(escapeBelongsToHost(doc.querySelector('textarea')), true)
  assert.equal(escapeBelongsToHost(doc.querySelector('input')), true)
  assert.equal(escapeBelongsToHost(doc.querySelector('[role="dialog"]')), true)
  assert.equal(escapeBelongsToHost(doc.querySelector('button')), false)
  assert.equal(escapeBelongsToHost(null), false)
})

test('built client registers tokens and removes them on dispose', async () => {
  const clientPath = new URL('../lib/client.js', import.meta.url)
  assert.equal(existsSync(clientPath), true)
  const source = readFileSync(clientPath, 'utf8')
  // 0.5.1: the only stored value is the message-letters choice (plain / collage).
  assert.equal(source.split('localStorage').length - 1, 1)
  assert.equal(source.includes('dsh-cc-message-style'), true)
  assert.equal(source.includes('setTheme'), false)
  assert.equal(source.includes('dsh-industrial'), false)
  assert.equal(source.includes('CcBrush'), false)
  assert.equal(source.includes("name: 'root'") || source.includes('name: "root"'), false)

  const dom = new JSDOM('<!doctype html><html><head><title>DeepSeek Harness</title></head><body></body></html>', {
    url: 'http://127.0.0.1:43123/',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
  })
  const { window } = dom
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false },
  })) as unknown as typeof window.matchMedia
  const captured: Array<{ id: string, factory: (require: (id: string) => unknown) => { apply: (ctx: unknown) => void, inject: string[], name: string } }> = []
  ;(window as unknown as { __ModuleLoader__: { load: (reg: unknown) => void } }).__ModuleLoader__ = {
    load(reg) { captured.push(reg as typeof captured[number]) },
  }
  vm.runInContext(source, dom.getInternalVMContext())
  assert.equal(captured.length, 1)
  assert.equal(captured[0].id, 'dsh-calling-card-skin')

  const hooks: unknown[] = []
  let hookCursor = 0
  const effects: Array<() => void> = []
  const react = {
    useState(init: unknown) {
      const index = hookCursor++
      if (hooks.length <= index) hooks[index] = typeof init === 'function' ? (init as () => unknown)() : init
      return [hooks[index], (value: unknown) => { hooks[index] = value }]
    },
    useRef(init: unknown) {
      const index = hookCursor++
      if (hooks.length <= index) hooks[index] = { current: init }
      return hooks[index] as { current: unknown }
    },
    useEffect(fn: () => void) { effects.push(fn) },
    createElement(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) {
      return { type, props: { ...(props ?? {}), children: props?.children ?? children } }
    },
  }
  const jsx = (type: unknown, props: Record<string, unknown> | null) => react.createElement(type, props)
  const mod = captured[0].factory((id) => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: Symbol.for('fragment') }
    throw new Error(`unexpected require ${id}`)
  })
  assert.deepEqual(Array.from(mod.inject), ['theme', 'slots'])
  assert.equal(mod.name, 'dsh-calling-card-skin')

  const seen: { layer: { source: string, tokens: Record<string, { light: string, dark: string }> } | null } = { layer: null }
  const registered: Array<{ options: { name: string, id: string, priority?: number }, component: (props: Record<string, unknown>) => unknown }> = []
  const stops: Array<() => void> = []
  mod.apply({
    theme: {
      overrideTokens(source: string, tokens: Record<string, { light: string, dark: string }>) {
        seen.layer = { source, tokens }
        for (const [name, modes] of Object.entries(tokens)) window.document.body.style.setProperty(name, modes.dark)
        return () => { seen.layer = null }
      },
    },
    slots: {
      inject(_key: string, callback: () => () => void) {
        const stop = callback()
        if (typeof stop === 'function') stops.push(stop)
        return () => stop?.()
      },
      register(options: { name: string, id: string, priority?: number }, component: (props: Record<string, unknown>) => unknown) {
        registered.push({ options, component })
        return () => {}
      },
    },
    effect(setup: () => (() => void) | void) {
      const stop = setup()
      if (typeof stop === 'function') stops.push(stop)
      return () => stop?.()
    },
    on() { return () => {} },
  })

  assert.equal(seen.layer?.source, 'dsh-calling-card-skin')
  assert.equal(seen.layer?.tokens['--dsw-alias-bg-base'].light, '#0c0c0c')
  assert.equal(window.document.documentElement.getAttribute('data-dsh-calling-card-skin'), '')
  const style = window.document.querySelector('style[data-plugin="dsh-calling-card-skin"]')
  assert.ok(style)
  assert.match(style?.textContent ?? '', /data-dsh-calling-card-skin/)
  assert.match(style?.textContent ?? '', /font-family: Anton/)
  assert.equal(window.document.documentElement.style.colorScheme, 'dark')

  const overlay = registered.find((entry) => entry.options.name === 'shell.overlay')
  const mark = registered.find((entry) => entry.options.name === 'sidebar.brand.mark')
  assert.ok(overlay)
  assert.equal(mark?.options.priority, -1)
  assert.equal(registered.some((entry) => entry.options.name === 'root'), false)
  assert.equal(registered.some((entry) => entry.options.name === 'sidebar'), false)

  const mount = window.document.createElement('div')
  window.document.body.appendChild(mount)
  const render = (node: unknown, parent: Element) => {
    if (node == null || node === false) return
    if (Array.isArray(node)) {
      node.forEach((child) => render(child, parent))
      return
    }
    if (typeof node === 'string' || typeof node === 'number') {
      parent.appendChild(window.document.createTextNode(String(node)))
      return
    }
    const element = node as { type: unknown, props?: Record<string, unknown> }
    if (typeof element.type === 'function') {
      hookCursor = 0
      render((element.type as (props: unknown) => unknown)(element.props ?? {}), parent)
      return
    }
    if (typeof element.type !== 'string') return
    const el = window.document.createElement(element.type)
    const props = element.props ?? {}
    if (typeof props.className === 'string') el.className = props.className
    if (props.role) el.setAttribute('role', String(props.role))
    if (props['aria-label']) el.setAttribute('aria-label', String(props['aria-label']))
    if (props.type) el.setAttribute('type', String(props.type))
    if (props.ref && typeof props.ref === 'object') (props.ref as { current: Element }).current = el
    const children = props.children
    const list = Array.isArray(children) ? children : children == null ? [] : [children]
    list.forEach((child) => render(child, el))
    parent.appendChild(el)
  }
  render(overlay?.component({}), mount)
  effects.forEach((fn) => fn())
  assert.equal(mount.querySelectorAll('.dsh-cc-glyph').length, 18)
  assert.equal(mount.querySelectorAll('.dsh-cc-railbrand .dsh-cc-glyph').length, 3)
  assert.equal(mount.querySelector('.dsh-cc-architecture')?.getAttribute('aria-label'), 'DEEPSEEK HARNESS')
  // 0.5.2: the replay stamp is gone; the caption cluster exists but stays off without the desktop API.
  assert.equal(mount.querySelector('.dsh-cc-replay'), null)
  assert.equal(mount.textContent?.includes('重播转场'), false)
  assert.equal(mount.querySelectorAll('.dsh-cc-win').length, 3)
  assert.equal(mount.querySelectorAll('.dsh-cc-menu').length, 2)
  assert.equal(mount.querySelector('.dsh-cc-chrome')?.hasAttribute('data-on'), false)
  assert.equal(window.document.documentElement.hasAttribute('data-cc-caption'), false)
  assert.ok(mount.querySelector('nav.dsh-cc-tickets'))
  assert.equal(mount.querySelector('.dsh-cc-overlay')?.getAttribute('class'), 'dsh-cc-overlay')
  const panel = window.document.createElement('button')
  panel.textContent = 'Plugins'
  window.document.body.appendChild(panel)
  panel.setAttribute('aria-current', 'page')
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(mount.querySelector('.dsh-cc-transition')?.classList.contains('is-on'), true)
  assert.match(mount.querySelector('.dsh-cc-motion-title')?.textContent ?? '', /PLUGINS/)
  assert.equal(mount.querySelector('.dsh-cc-motion-title')?.hasAttribute('data-cc-letters'), true)
  assert.equal(mount.querySelector('.dsh-cc-motion-kicker')?.textContent, 'HIDEOUT')
  assert.equal(mount.querySelector('.dsh-cc-caption-title')?.textContent, 'Plugins')
  assert.equal(mount.querySelector('.dsh-cc-sfx')?.classList.contains('is-on'), false)
  const flow = window.document.createElement('article')
  flow.setAttribute('data-chat-flow-kind', 'tool-call')
  window.document.body.appendChild(flow)
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(mount.querySelector('.dsh-cc-sfx')?.getAttribute('data-cc-kind'), 'tool')
  assert.equal(mount.querySelector('.dsh-cc-sfx')?.classList.contains('is-on'), true)
  assert.equal(window.document.title.includes('Plugins'), false)

  // Letters switch: flips the mode, stores it, and never replays the paper cut.
  const toggle = mount.querySelector('.dsh-cc-letters') as HTMLButtonElement
  assert.equal(toggle.getAttribute('role'), 'switch')
  assert.equal(toggle.getAttribute('aria-checked'), 'false')
  assert.equal(window.document.documentElement.getAttribute('data-cc-letters'), 'plain')
  const layerNode = mount.querySelector('.dsh-cc-transition') as HTMLElement
  const navDuration = layerNode.style.getPropertyValue('--dsh-cc-duration')
  toggle.click()
  assert.equal(toggle.getAttribute('aria-checked'), 'true')
  assert.equal(window.document.documentElement.getAttribute('data-cc-letters'), 'collage')
  assert.equal(window.localStorage.getItem('dsh-cc-message-style'), 'collage')
  assert.equal(layerNode.style.getPropertyValue('--dsh-cc-duration'), navDuration)
  toggle.click()
  assert.equal(window.localStorage.getItem('dsh-cc-message-style'), 'plain')

  for (const stop of stops) stop()
  assert.equal(seen.layer, null)
  assert.equal(window.document.documentElement.hasAttribute('data-dsh-calling-card-skin'), false)
  assert.equal(window.document.querySelector('style[data-plugin="dsh-calling-card-skin"]'), null)
})
