import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const executable = process.env.BROWSER_EXE || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync)
let server, browser, socket, sessionId, base, artifacts
let nextId = 0
const pending = new Map()
const errors = []

function outputMatch(child, stream, pattern) {
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output.slice(-800)}`)), 20000)
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Process exited: ${code}; ${output.slice(-800)}`)) })
    stream.on('data', chunk => {
      output += chunk
      const match = output.match(pattern)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
  })
}

function send(method, params = {}, target = sessionId) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 15000)
    pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result) }, reject })
    socket.send(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}

async function waitFor(expression) {
  await evaluate(`new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => { if (${expression}) resolve(true); else if (performance.now()-started > 6000) reject('Condition timed out'); else requestAnimationFrame(check) };
    check();
  })`)
}

async function navigate(path, width = 1440, height = 900) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${base}${path}` })
  await waitFor(`location.pathname === ${JSON.stringify(path.split('?')[0])} && document.readyState === 'complete'`)
  await evaluate('document.fonts.ready.then(() => true)')
  if (path.includes('desktop')) await waitFor("!!document.querySelector('.dsh-cc-chrome') && !!document.querySelector('[data-cc-leaf]')")
  await evaluate(`new Promise(resolve => setTimeout(resolve, 750))`)
}

async function pointer(selector, click = false) {
  const { x, y } = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); const r = e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2} })()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  if (click) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x, y })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x, y })
  }
  await evaluate('new Promise(resolve => setTimeout(resolve, 300))')
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(artifacts, `${name}.png`), Buffer.from(data, 'base64'))
}

before(async () => {
  assert.ok(executable, 'Set BROWSER_EXE to a Chromium browser executable')
  artifacts = await mkdtemp(join(tmpdir(), 'dsh-cc-ui-'))
  console.log(`UI screenshots: ${artifacts}`)
  server = spawn(process.execPath, ['scripts/preview-server.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] })
  base = await outputMatch(server, server.stdout, /preview (http:\/\/127\.0\.0\.1:\d+)/)
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${join(artifacts, 'profile')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const endpoint = await outputMatch(browser, browser.stderr, /DevTools listening on (ws:\/\/[^\s]+)/)
  socket = new WebSocket(endpoint)
  await once(socket, 'open')
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) request.reject(new Error(JSON.stringify(message.error)))
      else request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) errors.push(message.params.response.url)
  })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null)
  ;({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }, null))
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
})

after(async () => {
  if (socket?.readyState === WebSocket.OPEN) {
    await send('Browser.close', {}, null)
    socket.close()
  }
  server?.kill()
})

test('desktop: compact navigation keeps black borders at rest, on hover and when selected', async () => {
  for (const [width, height] of [[1440, 900], [1024, 640], [1024, 500]]) {
    await navigate('/desktop.html', width, height)
    assert.equal(await evaluate("document.querySelector('.dsh-cc-tagline').textContent"), 'TAKE YOUR HEART')
    const cards = await evaluate(`Array.from(document.querySelectorAll('[data-cc-leaf], #acct')).map(e => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const label = e.querySelector('.xx_wide').getBoundingClientRect();
      return {leaf:e.matches('[data-cc-leaf]'), text:e.textContent.trim(), border:s.borderTopWidth, color:s.borderTopColor, clip:s.clipPath,
        font:parseFloat(s.fontSize), height:parseFloat(s.height), width:parseFloat(s.width), margin:parseFloat(s.marginLeft),
        angle:Math.atan2(new DOMMatrix(s.transform).b,new DOMMatrix(s.transform).a)*180/Math.PI,
        parentWidth:e.parentElement.clientWidth, overflow:e.scrollWidth-e.clientWidth, rect:r.toJSON(), label:label.toJSON()};
    })`)
    assert.equal(cards.length, 4)
    for (const card of cards) {
      assert.equal(card.border, '3px', card.text)
      assert.equal(card.color, 'rgb(12, 12, 12)', card.text)
      assert.equal(card.clip, 'none', card.text)
      assert.ok(card.font <= 30 && card.height <= 44 && card.height >= 32, JSON.stringify(card))
      assert.ok(card.width <= card.parentWidth - 92, JSON.stringify(card))
      assert.ok(Math.abs(card.angle + 2) < 0.01, JSON.stringify(card))
      assert.equal(card.margin, 4 + cards.indexOf(card) * 10)
      if (card.leaf) assert.ok(card.overflow <= 1, JSON.stringify(card))
      assert.ok(card.label.x >= card.rect.x && card.label.right <= card.rect.right, JSON.stringify(card))
    }
    for (let i = 1; i < 3; i++) {
      assert.ok(cards[i].rect.top > cards[i - 1].rect.bottom, JSON.stringify(cards.slice(i - 1, i + 1)))
    }
    await shot(`compact-nav-${width}x${height}`)
    const leaf = '[data-cc-leaf][data-cc-i="1"]'
    await pointer(leaf, true)
    await waitFor(`document.querySelector('${leaf}').hasAttribute('data-cc-morph')`)
    const hover = await evaluate(`(() => {
      const e = document.querySelector('${leaf}'), s = getComputedStyle(e);
      const r = e.getBoundingClientRect(), p = e.querySelector('.dsh-cc-morph').getBoundingClientRect();
      return {border:s.borderTopWidth, color:s.borderTopColor, text:s.color, rect:r.toJSON(), plate:p.toJSON()};
    })()`)
    assert.equal(hover.border, '3px')
    assert.equal(hover.color, 'rgb(12, 12, 12)')
    assert.equal(hover.text, 'rgb(255, 255, 255)')
    assert.ok(hover.plate.x > hover.rect.x && hover.plate.right < hover.rect.right, JSON.stringify(hover))
    await evaluate(`document.querySelector('${leaf}').setAttribute('aria-current', 'page')`)
    await pointer('[data-conversation-header-leading]')
    assert.equal(await evaluate(`document.querySelector('${leaf}').getAttribute('data-cc-morph')`), 'leaf')
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('${leaf} > .dsh-cc-morph')).animationName`), 'none')
    await waitFor("!document.querySelector('.dsh-cc-transition.is-on')")
    const selected = await evaluate(`Array.from(document.querySelectorAll('[data-cc-leaf]')).map(e => e.getBoundingClientRect().toJSON())`)
    for (let i = 1; i < selected.length; i++) assert.ok(selected[i].top > selected[i - 1].bottom, JSON.stringify(selected))
    await shot(`compact-selected-${width}x${height}`)
    await pointer('#acct', true)
    assert.equal(await evaluate("document.querySelector('#acct').getAttribute('aria-expanded')"), 'true')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('#acct')).borderTopWidth"), '3px')
    await shot(`compact-more-${width}x${height}`)
  }
})

test('desktop: four localized navigation cards form an even diagonal stack', async () => {
  for (const [width, height, labels] of [
    [1440, 900, ['新会话', '插件', '自动化任务', '更多']],
    [1024, 500, ['新会话', '插件', '自动化任务', '更多']],
    [1024, 500, ['New Session', 'Plugins', 'Automation tasks', 'More']],
  ]) {
    await navigate('/desktop.html', width, height)
    await evaluate(`(() => {
      const extra = document.querySelector('[data-cc-i="1"]').cloneNode(true);
      extra.setAttribute('aria-label', ${JSON.stringify(labels[3])});
      document.querySelector('.wtg9ga_panelList').append(extra);
      ${JSON.stringify(labels)}.forEach((text, i) => document.querySelectorAll('[data-cc-leaf]')[i].querySelector('.xx_wide').textContent=text);
    })()`)
    await waitFor(`document.querySelector('[data-cc-i="3"]')?.textContent === ${JSON.stringify(labels[3])} && !document.querySelector('[data-cc-leaf][data-cc-enter]')`)
    const cards = await evaluate(`Array.from(document.querySelectorAll('[data-cc-leaf]')).map(e => {
      const s=getComputedStyle(e), r=e.getBoundingClientRect(), label=e.querySelector('.xx_wide').getBoundingClientRect();
      const hit=document.elementFromPoint(label.x+label.width/2,label.y+label.height/2);
      return {left:parseFloat(s.marginLeft), top:r.top, bottom:r.bottom, transform:s.transform, visible:e===hit||e.contains(hit), overflow:e.scrollWidth-e.clientWidth};
    })`)
    assert.equal(cards.length, 4)
    for (let i=0; i<4; i++) {
      assert.equal(cards[i].left, 4+i*10)
      assert.equal(cards[i].transform, cards[0].transform)
      assert.ok(cards[i].visible && cards[i].overflow <= 1, JSON.stringify(cards))
      if (i) assert.ok(cards[i].top > cards[i-1].bottom, JSON.stringify(cards))
    }
    await shot(`diagonal-four-${width}x${height}-${labels[3] === 'More' ? 'en' : 'zh'}`)
  }
})

test('desktop: localized navigation and reduced motion retain readable compact cards', async () => {
  await navigate('/desktop.html', 1024, 640)
  await evaluate(`['新会话', '插件', '自动化任务'].forEach((text, i) => {
    document.querySelector('[data-cc-i="'+i+'"] .xx_wide').textContent = text;
  })`)
  await waitFor("document.querySelector('[data-cc-i=\"2\"]').getAttribute('data-cc-lines') === '1'")
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await pointer('[data-cc-i="2"]')
  const state = await evaluate(`(() => {
    const e = document.querySelector('[data-cc-i="2"]'), s = getComputedStyle(e);
    const r = e.getBoundingClientRect(), t = e.querySelector('.xx_wide').getBoundingClientRect();
    return {animation:s.animationName, border:s.borderTopWidth, fits:t.x >= r.x && t.right <= r.right};
  })()`)
  assert.equal(state.animation, 'none')
  assert.equal(state.border, '3px')
  assert.ok(state.fits)
  await shot('compact-nav-chinese-reduced-motion')
  await send('Emulation.setEmulatedMedia', { features: [] })
})

test('desktop: workspace gains usable list height without shrinking its rows', async () => {
  for (const [width, height] of [[1440, 900], [1024, 640], [1024, 500]]) {
    await navigate('/desktop.html', width, height)
    const space = await evaluate(`(() => {
      const region = document.querySelector('.wtg9ga_regionArea');
      const first = document.querySelector('[data-row-key="workspace:dsh"]');
      const available = () => region.getBoundingClientRect().bottom - first.getBoundingClientRect().top;
      const current = available();
      const old = document.createElement('style');
      old.textContent = \`
        html[data-dsh-calling-card-skin] div:has(> [data-shell-overlay]):not([data-sidebar-collapsed]) [data-cc-leaf] { margin-top:26px; padding:5px 10px; width:calc(100% - 64px); }
        html[data-dsh-calling-card-skin] div:has(> [data-shell-overlay]):not([data-sidebar-collapsed]) [data-cc-leaf][data-cc-lines="1"] { height:\${innerHeight <= 640 ? 42 : 48}px; min-height:40px; max-height:48px; }
        html[data-dsh-calling-card-skin] div:has(> [data-shell-overlay]):not([data-sidebar-collapsed]) [data-cc-leaf][data-cc-lines="2"] { min-height:\${innerHeight <= 640 ? 46 : 50}px; max-height:none; }
        html[data-dsh-calling-card-skin] div:has(> [data-shell-overlay]):not([data-sidebar-collapsed]) [data-cc-leaf][data-cc-i="0"] { margin-top:\${innerHeight <= 640 ? '86px' : 'clamp(108px, 17vh, 162px)'}; }
        html[data-dsh-calling-card-skin] [data-signed-out][aria-haspopup="menu"]:not([data-collapsed="true"]) { height:36px !important; }
      \`;
      document.head.append(old);
      const previous = available();
      old.remove();
      const tagline = document.querySelector('.dsh-cc-tagline').getBoundingClientRect();
      const nav = document.querySelector('[data-cc-i="0"]').getBoundingClientRect();
      return {current, previous, gain:current-previous, rowHeight:first.offsetHeight, brandClear:nav.top > tagline.bottom};
    })()`)
    console.log('Workspace space:', JSON.stringify({width, height, ...space}))
    assert.ok(space.gain >= 35, JSON.stringify(space))
    assert.equal(space.rowHeight, 34)
    assert.ok(space.brandClear)
    assert.equal(await evaluate("document.querySelector('#acct').getBoundingClientRect().bottom <= document.documentElement.clientHeight"), true)
    await shot(`workspace-${width}x${height}`)
    await evaluate(`(() => {
      const list = document.querySelector('.GAkraW_listArea'), row = list.querySelector('[data-row-key="session:demo-4"]');
      for (let i=0; i<8; i++) { const copy=row.cloneNode(true); copy.setAttribute('data-row-key','session:overflow-'+i); list.append(copy); }
    })()`)
    await pointer('[data-row-key="workspace:dsh"]')
    await send('Input.dispatchMouseEvent', { type:'mouseWheel', x:100, y:height-125, deltaX:0, deltaY:500 })
    await waitFor("document.querySelector('.wtg9ga_regionArea').scrollTop > 0")
    assert.equal(await evaluate("document.querySelector('#acct').checkVisibility()"), true)
    await shot(`workspace-scrolled-${width}x${height}`)
  }
})

test('desktop: session actions share the row without covering its title', async () => {
  await navigate('/desktop.html')
  const row = '[data-row-key="session:demo-4"]'
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('${row} > [class*="_rowActions"]')).display`), 'none')
  await pointer(row)
  const layout = await evaluate(`(() => { const r=document.querySelector('${row}'); const t=r.querySelector('[class*="_title"]').getBoundingClientRect(); const a=r.querySelector('[class*="_rowActions"]'); return {titleRight:t.right,actionsLeft:a.getBoundingClientRect().left,display:getComputedStyle(a).display,resting:getComputedStyle(r.querySelector('[class*="_rowResting"]')).display} })()`)
  await shot('desktop-actions')
  assert.equal(layout.display, 'flex')
  assert.equal(layout.resting, 'none')
  assert.ok(layout.titleRight <= layout.actionsLeft + 1, JSON.stringify(layout))
})

test('collapsed rail: MORE opens the real fixture menu at desktop and short heights', async () => {
  for (const [width, height] of [[1440, 900], [1024, 640], [1024, 500]]) {
    await navigate('/desktop.html', width, height)
    await pointer('[data-sidebar-toggle]', true)
    await waitFor("document.documentElement.hasAttribute('data-cc-rail')")
    const tagline = await evaluate(`(() => {
      const e = document.querySelector('.dsh-cc-tagline');
      return {text:e.textContent, rect:e.getBoundingClientRect().toJSON()};
    })()`)
    assert.equal(tagline.text, 'TAKE YOUR HEART')
    assert.ok(tagline.rect.x >= 0 && tagline.rect.y >= 0 && tagline.rect.right <= width && tagline.rect.bottom <= height, JSON.stringify(tagline))
    const layout = await evaluate(`(() => { const e=document.querySelector('#acct'); const r=e.getBoundingClientRect(); const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return {r:r.toJSON(),visible:e.checkVisibility(),hit:hit===e||e.contains(hit),label:getComputedStyle(e,'::before').content} })()`)
    await shot(`rail-${width}x${height}`)
    assert.ok(layout.visible && layout.hit, JSON.stringify(layout))
    assert.ok(layout.r.y >= 0 && layout.r.bottom <= height, JSON.stringify(layout))
    assert.equal(layout.label, '"MORE"')
    await pointer('#acct', true)
    assert.equal(await evaluate("document.querySelector('#acct').getAttribute('aria-expanded')"), 'true')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('#fixture-acct-menu')).display"), 'flex')
    assert.notEqual(await evaluate("getComputedStyle(document.querySelector('#acct'),'::before').display"), 'none')
    await shot(`rail-menu-${width}x${height}`)
    await pointer('#acct', true)
    await pointer('[data-sidebar-toggle]', true)
    await waitFor("!document.documentElement.hasAttribute('data-cc-rail')")
    assert.equal(await evaluate("document.querySelectorAll('[data-cc-rail-btn]').length"), 0)
  }
})

test('menus: hover, keyboard focus, disabled items and tooltips retain readable styles', async () => {
  await navigate('/menus.html')
  await pointer('#m-acct button')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-acct button')).color"), 'rgb(11, 11, 11)')
  await pointer('#m-model [aria-disabled="true"]')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-model [aria-disabled]')).color"), 'rgb(138, 138, 138)')
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  assert.equal(await evaluate("document.activeElement.matches(':focus-visible')"), true)
  await shot('menus')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[role=tooltip]')).borderRadius"), '0px')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-acct')).animationName"), 'none')
  await send('Emulation.setEmulatedMedia', { features: [] })
})

test('submenus keep their pointer bridge and support keyboard entry and exit', async () => {
  await navigate('/menus.html')
  const trigger = '#m-ctx [aria-haspopup="menu"]'
  await pointer(trigger)
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#fixture-submenu')).display"), 'flex')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#fixture-submenu')).animationName"), 'none')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#fixture-submenu'),'::before').width"), '10px')
  await pointer('#fixture-submenu button')
  assert.equal(await evaluate("document.querySelector('#fixture-submenu').checkVisibility()"), true)
  await shot('submenu')
  await evaluate("document.querySelector('#fixture-submenu button').focus()")
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  assert.equal(await evaluate("document.querySelector('#fixture-submenu').style.display"), 'none')
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
  assert.equal(await evaluate("document.querySelector('#fixture-submenu').contains(document.activeElement)"), true)
})

test('model surface preserves its red backing and the internal list still scrolls', async () => {
  await navigate('/menus.html')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-model')).overflow"), 'visible')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-model > ._9r0rkG_groups')).overflowY"), 'auto')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-model ._9r0rkG_check')).color"), 'rgb(230, 0, 18)')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[role=tooltip] kbd')).backgroundColor"), 'rgb(230, 0, 18)')
  const scroll = await evaluate(`(() => {
    const list = document.querySelector('#m-model > ._9r0rkG_groups');
    for (let i=0; i<20; i++) list.append(list.querySelector('button').cloneNode(true));
    list.scrollTop = list.scrollHeight;
    return {height:list.clientHeight,total:list.scrollHeight,offset:list.scrollTop};
  })()`)
  assert.ok(scroll.offset > 0 && scroll.total > scroll.height, JSON.stringify(scroll))
  await shot('model-scroll')
})

test('streaming: existing reply text skips document-wide scans and new content still gets styled', async () => {
  await navigate('/desktop.html?letters=plain')
  const scans = await evaluate(`(async () => {
    const paragraph = document.querySelector('[data-chat-flow-kind="assistant-step"] p');
    const query = document.querySelectorAll;
    let count = 0;
    document.querySelectorAll = function (...args) { count++; return query.apply(this, args); };
    try {
      for (let i = 0; i < 60; i++) {
        if (i % 2) paragraph.firstChild.data += 'x';
        else paragraph.textContent += 'x';
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      return count;
    } finally {
      document.querySelectorAll = query;
    }
  })()`)
  assert.equal(scans, 0, `Document-wide scans for 60 plain reply updates: ${scans}`)
  await evaluate(`document.querySelector('[data-conversation-scroll]').insertAdjacentHTML('beforeend',
    '<article data-chat-flow-kind="assistant-step" id="new-reply"><p>Stream starts</p><div data-presented-file><p class="xx_fileName">notes.md</p><span class="xx_fileIcon"></span></div></article>')`)
  await waitFor("document.querySelector('#new-reply').hasAttribute('data-cc-enter') && document.querySelector('.xx_fileIcon').getAttribute('data-cc-ext') === 'MD'")
  await evaluate("document.querySelector('.xx_fileName').firstChild.data = 'notes.png'")
  await waitFor("document.querySelector('.xx_fileIcon').getAttribute('data-cc-ext') === 'PNG'")
  await evaluate("document.querySelector('.dsh-cc-letters').click()")
  await waitFor("!!document.querySelector('#new-reply p > .dsh-cc-collage')")
  await evaluate("document.querySelector('#new-reply p').firstChild.data = 'Stream continues'")
  await waitFor("document.querySelector('#new-reply p').getAttribute('data-cc-collage-pending') === 'Stream continues'")
  await waitFor("document.querySelector('#new-reply p').getAttribute('data-cc-collage') === 'Stream continues'")
})

test('fixtures: conversation and widget pages load without script or resource errors', async () => {
  for (const path of ['/conversation.html', '/widgets.html', '/']) {
    await navigate(path)
    assert.equal(await evaluate("document.documentElement.hasAttribute('data-dsh-calling-card-skin')"), true)
  }
  assert.deepEqual(errors.filter(e => !e.endsWith('/favicon.ico')), [])
})
