import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { createGiant, giantWord } from '../src/client/giant.ts'

const hero = { no: '00', title: '新预告信', kicker: 'CALLING CARD', local: '新会话' }
const plugins = { no: '02', title: 'Plugins', kicker: 'HIDEOUT', local: '据点' }
const chinesePanel = { no: '03', title: '自动化任务', kicker: 'HIDEOUT', local: '据点' }
const session = { no: '01', title: '检查令牌刷新', kicker: 'INFILTRATION', local: '潜入中' }

test('giant word: English panel names go huge, everything else shows the heist name', () => {
  assert.equal(giantWord(hero), 'CALLING CARD')
  assert.equal(giantWord(plugins), 'PLUGINS')
  assert.equal(giantWord(chinesePanel), 'HIDEOUT')
  assert.equal(giantWord(session), 'INFILTRATION')
  assert.equal(giantWord({ ...plugins, title: 'A very long panel name here' }), 'HIDEOUT')
})

test('giant title is decorative, fills once without a slam, slams on change, and leaves on dispose', () => {
  const { window } = new JSDOM('<div id="ground"></div>')
  const doc = window.document
  const giant = createGiant(doc)
  doc.getElementById('ground')!.append(giant.root)
  assert.equal(giant.root.getAttribute('aria-hidden'), 'true')
  giant.update(hero)
  assert.equal(giant.root.textContent, 'CALLING CARD')
  assert.equal(giant.root.getAttribute('data-cc-text'), 'CALLING CARD')
  assert.equal(giant.root.classList.contains('is-slam'), false)
  giant.update(hero)
  assert.equal(giant.root.classList.contains('is-slam'), false)
  giant.update(plugins)
  assert.equal(giant.root.textContent, 'PLUGINS')
  assert.equal(giant.root.classList.contains('is-slam'), true)
  giant.dispose()
  assert.equal(doc.querySelector('.dsh-cc-giant'), null)
})

test('0.5.0 composition CSS: giant behind and click-through, landing and composer stay readable, motion off when reduced', () => {
  const css = readFileSync(new URL('../src/client/skin.css', import.meta.url), 'utf8')
  const giant = css.match(/\.dsh-cc-giant \{([\s\S]*?)\}/)![1]
  assert.match(giant, /pointer-events: none/)
  assert.match(giant, /overflow: hidden/)
  // Landing art sits behind the content of the phase, never on it.
  assert.match(css, /\[data-phase="hero"\]::before,\s*html\[data-dsh-calling-card-skin\] \[data-phase="hero"\]::after \{[\s\S]*?z-index: -1;[\s\S]*?pointer-events: none;/)
  // Composer: light text on the black card.
  const composer = css.slice(css.indexOf('/* P5 composer:'))
  assert.match(composer, /\[data-composer-input\] \{\s*color: #fff;/)
  assert.match(composer, /--dsw-alias-label-primary: #fff;/)
  // The giant slam is transform-only and the global reduced-motion switch covers it.
  const slam = css.match(/@keyframes dsh-cc-giant-slam \{([\s\S]*?)\n\}/)![1]
  assert.doesNotMatch(slam, /opacity|color|width|height|left|top/)
  assert.ok(css.indexOf('@keyframes dsh-cc-giant-slam') < css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
})
