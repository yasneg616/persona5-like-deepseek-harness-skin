/* Test fixture runner. Not the Harness client. Mounts the built plugin on a labeled DOM. */
const captured = []
window.__ModuleLoader__ = { load(reg) { captured.push(reg) } }

function boot() {
  const reg = captured[0]
  if (!reg) throw new Error('plugin factory was not registered')
  const hooks = []
  let cursor = 0
  const effects = []
  const react = {
    useState(init) {
      const index = cursor++
      if (hooks.length <= index) hooks[index] = typeof init === 'function' ? init() : init
      return [hooks[index], (value) => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value }]
    },
    useRef(init) {
      const index = cursor++
      if (hooks.length <= index) hooks[index] = { current: init }
      return hooks[index]
    },
    useEffect(fn) { effects.push(fn) },
    createElement(type, props, ...children) {
      return { type, props: { ...(props || {}), children: props && 'children' in props ? props.children : children } }
    },
  }
  const jsx = (type, props) => react.createElement(type, props)
  const mod = reg.factory((id) => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: Symbol.for('fragment') }
    throw new Error(id)
  })
  const stops = []
  mod.apply({
    theme: {
      overrideTokens(_source, tokens) {
        for (const [name, modes] of Object.entries(tokens)) document.body.style.setProperty(name, modes.dark)
        return () => {}
      },
    },
    slots: {
      inject(_key, callback) {
        const stop = callback()
        if (typeof stop === 'function') stops.push(stop)
        return () => stop && stop()
      },
      register(options, component) {
        window.__callingCardSlots = window.__callingCardSlots || []
        window.__callingCardSlots.push({ options, component })
        return () => {}
      },
    },
    effect(setup) {
      const stop = setup()
      if (typeof stop === 'function') stops.push(stop)
      return () => stop && stop()
    },
    on() { return () => {} },
  })
  const overlay = window.__callingCardSlots.find((entry) => entry.options.name === 'shell.overlay')
  const host = document.querySelector('[data-shell-overlay]')
  const render = (node, parent) => {
    if (node == null || node === false) return
    if (Array.isArray(node)) { node.forEach((child) => render(child, parent)); return }
    if (typeof node === 'string' || typeof node === 'number') { parent.appendChild(document.createTextNode(String(node))); return }
    if (typeof node.type === 'function') {
      cursor = 0
      render(node.type(node.props || {}), parent)
      return
    }
    if (typeof node.type !== 'string') return
    const el = document.createElement(node.type)
    const props = node.props || {}
    if (props.className) el.className = props.className
    if (props.role) el.setAttribute('role', props.role)
    if (props['aria-label']) el.setAttribute('aria-label', props['aria-label'])
    if (props['aria-hidden']) el.setAttribute('aria-hidden', props['aria-hidden'])
    if (props.type) el.setAttribute('type', props.type)
    if (props.width) el.setAttribute('width', props.width)
    if (props.height) el.setAttribute('height', props.height)
    if (props.viewBox) el.setAttribute('viewBox', props.viewBox)
    if (props.fill) el.setAttribute('fill', props.fill)
    if (props.stroke) el.setAttribute('stroke', props.stroke)
    if (props.strokeWidth) el.setAttribute('stroke-width', props.strokeWidth)
    if (props.points) el.setAttribute('points', props.points)
    if (props.style) for (const [key, value] of Object.entries(props.style)) el.style.setProperty(key, String(value))
    if (props.ref) props.ref.current = el
    const children = Array.isArray(props.children) ? props.children : props.children == null ? [] : [props.children]
    children.forEach((child) => render(child, el))
    parent.appendChild(el)
  }
  render(overlay.component({}), host)
  effects.forEach((fn) => fn())
  document.querySelector('[data-fixture-status]').textContent = '夹具已挂上构建后的 client.js。没有会话服务，也没有模型请求。'
  scheduleAct(new URLSearchParams(location.search).get('act'))
}

/*
 * Optional scripted step for screenshots: ?act=burst appends a tool card,
 * ?act=nav switches the current panel. The frame is then frozen
 * mid-animation so a headless shot shows the burst or the cut.
 */
function scheduleAct(act) {
  if (!act) return
  const at = { burst: 3550, nav: 3700 }[act]
  if (!at) return
  const fire = () => {
    if (act === 'burst') {
      const card = document.createElement('article')
      card.setAttribute('data-chat-flow-kind', 'tool-call')
      card.innerHTML = '<h3>run_tests</h3><p>夹具工具卡，没有执行命令。</p>'
      document.querySelector('[data-conversation-scroll]').appendChild(card)
    }
    if (act === 'nav') {
      for (const node of document.querySelectorAll('[aria-current="page"]')) node.removeAttribute('aria-current')
      const panel = document.querySelector('[data-fixture-panel]')
      panel.setAttribute('aria-current', 'page')
      document.querySelector('[data-conversation-header-leading]')?.remove()
    }
  }
  // Freeze the frame mid-animation so a headless shot catches it: pause every
  // animation and drop the pending timers that would end it. Fixture only.
  const hold = { burst: 380, nav: 330 }[act]
  const freeze = () => {
    // Headless virtual time does not advance the animation timeline, so seek explicitly.
    document.getAnimations().forEach((animation) => {
      animation.pause()
      animation.currentTime = hold
    })
    const last = setTimeout(() => {}, 0)
    for (let id = 0; id <= last; id += 1) clearTimeout(id)
    document.documentElement.setAttribute('data-fixture-frozen', act)
  }
  setTimeout(() => {
    fire()
    setTimeout(freeze, hold)
  }, Math.max(300, at - performance.now()))
}

const script = document.createElement('script')
script.src = '../lib/client.js'
script.onload = boot
document.body.appendChild(script)
