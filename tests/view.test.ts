import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { clearHeroType, clearNavLeaves, syncHeroType, syncNavLeaves } from '../src/client/leaves.ts'
import { resolveArchitectureLabel } from '../src/client/title.ts'
import { cutoutFor } from '../src/client/cutouts.ts'

test('the brand stays two cutout lines and the panel is only a chip', () => {
  assert.deepEqual(resolveArchitectureLabel({
    panelLabel: 'Plugins',
    headerLabel: null,
    sessionLabel: null,
  }), { text: 'DEEPSEEK', lines: ['DEEPSEEK', 'HARNESS'], mode: 'cutout', state: 'PLUGINS' })
  assert.deepEqual(resolveArchitectureLabel({
    panelLabel: null,
    headerLabel: 'DeepSeek Harness',
    sessionLabel: '修好用例',
  }).state, '修好用例')
  assert.equal(resolveArchitectureLabel({
    panelLabel: 'Automation tasks',
    headerLabel: null,
    sessionLabel: null,
  }).state, 'AUTOMATION TASKS')
  assert.equal(resolveArchitectureLabel({
    panelLabel: 'New Session',
    headerLabel: null,
    sessionLabel: 'New Session',
    phase: 'hero',
  }).state, null)
  const deepseek = cutoutFor('DEEPSEEK')
  const faces = new Set(deepseek.map((letter) => letter.face))
  assert.ok(faces.size >= 2)
  assert.ok(deepseek.every((letter) => letter.sx >= 0.7 && letter.w >= letter.sx * 0.7))
  assert.equal(cutoutFor('HARNESS').map((letter) => letter.c).join(''), 'HARNESS')
  assert.equal(cutoutFor('SESSION').length, 7)
})

test('sidebar leaves mark real labels and restore cleanly', () => {
  const dom = new JSDOM(`<div id="frame">
    <div>
      <button><span class="dsh-cc-name">DSH</span></button>
      <button data-sidebar-toggle aria-label="Collapse"></button>
      <button>New Session</button>
      <button aria-current="page">Plugins</button>
      <button aria-label="Search"></button>
      <button data-signed-out>More</button>
    </div>
    <div></div>
    <div data-shell-overlay></div>
  </div>`)
  syncNavLeaves(dom.window.document)
  const marked = Array.from(dom.window.document.querySelectorAll('[data-cc-leaf]')).map((el) => el.textContent?.trim())
  assert.deepEqual(marked, ['New Session', 'Plugins'])
  assert.equal(dom.window.document.querySelector('[aria-current="page"]')?.getAttribute('data-cc-gloss'), '插件')
  assert.equal(dom.window.document.querySelector('[aria-current="page"]')?.getAttribute('data-cc-num'), '02')
  assert.equal(dom.window.document.querySelector('[aria-current="page"]')?.getAttribute('data-cc-lines'), '1')
  const sessionLeaf = Array.from(dom.window.document.querySelectorAll('button')).find((button) => button.textContent?.includes('New Session'))
  assert.equal(sessionLeaf?.getAttribute('data-cc-lines'), '1')
  assert.equal(dom.window.document.querySelector('[aria-current="page"]')?.getAttribute('data-cc-leaf'), '')
  clearNavLeaves(dom.window.document)
  assert.equal(dom.window.document.querySelector('[data-cc-leaf]'), null)
})

test('hero markers style the native headline and come off on cleanup', () => {
  const dom = new JSDOM(`<div data-phase="hero">
    <span class="hitbox"><div><svg class="dsh-cc-hero"></svg></div></span>
    <span class="title"><span>Into the Unknown</span><span>Preview</span></span>
  </div>`)
  syncHeroType(dom.window.document)
  assert.equal(dom.window.document.querySelector('[data-cc-hero-title]')?.textContent, 'Into the Unknown')
  assert.equal(dom.window.document.querySelector('[data-cc-hero-tag]')?.textContent, 'Preview')
  clearHeroType(dom.window.document)
  assert.equal(dom.window.document.querySelector('[data-cc-hero-title]'), null)
})

test('long and Chinese page names stay secondary chips', () => {
  const chinese = resolveArchitectureLabel({
    panelLabel: '自动化任务',
    headerLabel: null,
    sessionLabel: null,
  })
  assert.equal(chinese.mode, 'cutout')
  assert.equal(chinese.state, '自动化任务')
  assert.equal(resolveArchitectureLabel({
    panelLabel: 'Experimental plugins page',
    headerLabel: null,
    sessionLabel: null,
  }).state, 'Experimental plugins page')
})

test('stylesheet keeps paper slips, stepped leaves, and reduced motion', () => {
  const css = readFileSync(new URL('../src/client/skin.css', import.meta.url), 'utf8')
  assert.match(css, /data-cc-leaf/)
  assert.match(css, /aria-current="page"/)
  assert.match(css, /data-chat-flow-kind="user"/)
  assert.match(css, /data-chat-flow-kind="assistant-step"/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
  assert.match(css, /\.dsh-cc-transition\s*\{[^}]*display:\s*none/)
  assert.match(css, /--dsh-cc-mast/)
  assert.match(css, /--dsh-cc-sheet-top/)
  assert.match(css, /z-index:\s*-1/)
  assert.match(css, /data-cc-hero-title/)
  assert.match(css, /data-cc-gloss/)
  assert.doesNotMatch(css, /height:\s*14px;\s*\n\s*background:\s*var\(--dsh-cc-red\)/)
  assert.doesNotMatch(css, /top:\s*18px;\s*right:\s*22px/)
})
