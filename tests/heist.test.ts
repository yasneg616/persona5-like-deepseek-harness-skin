import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { createCaption, readViewSignals, resolveSection } from '../src/client/title.ts'
import { cutsAsLetters } from '../src/client/transition.ts'
import { BURST_GAP_MS, SFX_WORDS, burstFor, countFlows, createBurst } from '../src/client/sfx.ts'

const none = { panelLabel: null, headerLabel: null, sessionLabel: null }

test('resolveSection names the landing, a session, and a panel', () => {
  assert.deepEqual(resolveSection({ ...none, panelLabel: 'New Session', phase: 'hero' }), {
    no: '00', title: '新预告信', kicker: 'CALLING CARD', local: '新会话',
  })
  assert.deepEqual(resolveSection({ ...none, headerLabel: '修好用例', sessionLabel: '修好用例', phase: 'active' }), {
    no: '01', title: '修好用例', kicker: 'INFILTRATION', local: '潜入中',
  })
  assert.deepEqual(resolveSection({ ...none, panelLabel: 'Plugins', panelNumber: '02' }), {
    no: '02', title: 'Plugins', kicker: 'HIDEOUT', local: '据点',
  })
  assert.equal(resolveSection({ ...none, panelLabel: 'Plugins' }).no, '01')
  assert.equal(resolveSection({ ...none, panelLabel: 'Plugins', sessionLabel: '修好用例' }).kicker, 'HIDEOUT')
  assert.equal(resolveSection({ ...none, panelLabel: 'Plugins', headerLabel: '修好用例' }).kicker, 'INFILTRATION')
  assert.equal(resolveSection({ ...none, headerLabel: 'DeepSeek Harness' }).kicker, 'INFILTRATION')
  assert.equal(resolveSection({ ...none, headerLabel: 'DeepSeek Harness' }).title, 'SESSION')
  const long = resolveSection({ ...none, sessionLabel: '很'.repeat(40) }).title
  assert.equal([...long].length, 28)
  assert.ok(long.endsWith('…'))
})

test('view signals read the panel number the leaf carries', () => {
  const doc = new JSDOM('<button aria-current="page" data-cc-num="03">Automation tasks</button>').window.document
  const signals = readViewSignals(doc)
  assert.equal(signals.panelNumber, '03')
  assert.equal(resolveSection(signals).no, '03')
})

test('caption box updates in place and disposes', () => {
  const doc = new JSDOM('<div id="host"></div>').window.document
  const caption = createCaption(doc)
  doc.getElementById('host')!.append(caption.root)
  caption.update(resolveSection({ ...none, phase: 'hero' }))
  assert.equal(caption.root.getAttribute('aria-hidden'), 'true')
  assert.equal(caption.root.querySelector('.dsh-cc-caption-no')?.textContent, '00')
  assert.equal(caption.root.querySelector('.dsh-cc-caption-title')?.textContent, '新预告信')
  assert.match(caption.root.querySelector('.dsh-cc-caption-kicker')?.textContent ?? '', /CALLING CARD/)
  const title = caption.root.querySelector('.dsh-cc-caption-title')
  caption.update(resolveSection({ ...none, panelLabel: 'Plugins', panelNumber: '02' }))
  assert.equal(caption.root.querySelector('.dsh-cc-caption-title'), title)
  assert.equal(title?.textContent, 'Plugins')
  assert.equal(caption.root.getAttribute('data-cc-kicker'), 'HIDEOUT')
  caption.dispose()
  assert.equal(doc.querySelector('.dsh-cc-caption'), null)
})

test('cutsAsLetters takes short Latin caps only', () => {
  assert.equal(cutsAsLetters('PLUGINS'), true)
  assert.equal(cutsAsLetters('NEW SESSION'), true)
  assert.equal(cutsAsLetters('AUTOMATION TASKS'), false)
  assert.equal(cutsAsLetters('Plugins'), false)
  assert.equal(cutsAsLetters('自动化任务'), false)
  assert.equal(cutsAsLetters('A'), false)
})

test('burstFor ranks tool over prompt over reply and ignores shrink', () => {
  const base = { user: 1, tool: 1, assistant: 1 }
  assert.equal(burstFor(base, base), null)
  assert.equal(burstFor(base, { user: 2, tool: 2, assistant: 2 }), 'tool')
  assert.equal(burstFor(base, { user: 2, tool: 1, assistant: 2 }), 'user')
  assert.equal(burstFor(base, { user: 1, tool: 1, assistant: 2 }), 'assistant')
  assert.equal(burstFor(base, { user: 0, tool: 0, assistant: 0 }), null)
  const doc = new JSDOM(`<div data-chat-flow-kind="user"></div><div data-chat-flow-kind="steering"></div>
    <div data-chat-flow-kind="tool-call"></div><div data-chat-flow-kind="assistant-step"></div>`).window.document
  assert.deepEqual(countFlows(doc), { user: 2, tool: 1, assistant: 1 })
})

function windowWith(reduce: boolean) {
  const dom = new JSDOM('<body></body>', { pretendToBeVisual: true })
  dom.window.matchMedia = ((query: string) => ({ matches: reduce && query.includes('reduce'), media: query })) as unknown as typeof dom.window.matchMedia
  return dom.window
}

test('burst pops at most once per gap, shows the word, and disposes', () => {
  const win = windowWith(false)
  const burst = createBurst(win.document, win as unknown as Window)
  win.document.body.append(burst.root)
  assert.equal(burst.root.getAttribute('aria-hidden'), 'true')
  assert.equal(burst.pop('tool', 10_000), true)
  assert.equal(burst.root.classList.contains('is-on'), true)
  assert.equal(burst.root.getAttribute('data-cc-kind'), 'tool')
  assert.equal(burst.root.textContent, SFX_WORDS.tool)
  assert.equal(burst.pop('user', 10_000 + BURST_GAP_MS - 1), false)
  assert.equal(burst.root.textContent, SFX_WORDS.tool)
  assert.equal(burst.pop('user', 10_000 + BURST_GAP_MS), true)
  assert.equal(burst.root.textContent, SFX_WORDS.user)
  burst.dispose()
  assert.equal(win.document.querySelector('.dsh-cc-sfx'), null)
})

test('burst stays off under reduced motion', () => {
  const win = windowWith(true)
  const burst = createBurst(win.document, win as unknown as Window)
  assert.equal(burst.pop('assistant', 0), false)
  assert.equal(burst.root.classList.contains('is-on'), false)
})

test('sound words are short readable onomatopoeia', () => {
  for (const word of Object.values(SFX_WORDS)) {
    assert.ok([...word].length >= 1 && [...word].length <= 4, word)
    assert.equal(word.includes('\uFFFD'), false)
  }
})
