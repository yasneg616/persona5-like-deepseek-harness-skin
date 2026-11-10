import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { TITLE_CUT_MAX, piecesFor, restoreCollage, syncCollage } from '../src/client/collage.ts'

function dom(html: string) {
  return new JSDOM(html).window.document
}

test('pieces keep the original characters in order and mix faces', () => {
  assert.equal(piecesFor('Into the Unknown').map((piece) => piece.text).join(''), 'Into the Unknown')
  assert.deepEqual(piecesFor('a b').map((piece) => piece.kind), ['letter', 'plain', 'letter'])
  const faces = new Set(piecesFor('探索未至之境').map((piece) => piece.face).filter(Boolean))
  assert.ok(faces.size >= 2)
  assert.equal(piecesFor('探索未至之境').some((piece) => piece.face === 'CcBrush'), false)
})

test('only the welcome headline is cut; tags stay plain', () => {
  const documentRef = dom(`<div data-conversation-scroll>
    <h1 data-cc-hero-title>探索未至之境</h1>
    <span data-cc-hero-tag>预览版</span>
    <h1 data-cc-hero-title>Into the Unknown</h1>
    <span data-cc-hero-tag>Preview</span>
  </div>`)
  syncCollage(documentRef, 0)
  syncCollage(documentRef, 600)
  const titles = Array.from(documentRef.querySelectorAll('[data-cc-hero-title]'))
  assert.deepEqual(
    Array.from(titles[0].querySelectorAll('.dsh-cc-han')).map((tile) => tile.textContent),
    [...'探索未至之境'],
  )
  assert.equal(titles[1].textContent, 'Into the Unknown')
  assert.deepEqual(Array.from(titles[1].querySelectorAll('.dsh-cc-word')).map((word) => word.textContent), ['Into', 'the', 'Unknown'])
  const englishFaces = new Set(Array.from(titles[1].querySelectorAll('.dsh-cc-han')).map((tile) => tile.getAttribute('data-cc-face')))
  assert.ok(englishFaces.has('Anton'))
  assert.ok(englishFaces.size >= 2)
  assert.equal(titles[1].getAttribute('aria-label'), 'Into the Unknown')
  for (const tag of Array.from(documentRef.querySelectorAll('[data-cc-hero-tag]'))) assert.equal(tag.querySelector('.dsh-cc-han'), null)
  const firstCount = titles[1].querySelectorAll('.dsh-cc-han').length
  syncCollage(documentRef, 1_200)
  assert.equal(titles[1].querySelectorAll('.dsh-cc-han').length, firstCount)
  assert.equal(titles[1].querySelector('.dsh-cc-han .dsh-cc-han'), null)
  restoreCollage(documentRef)
  assert.equal(documentRef.querySelector('.dsh-cc-han, [data-cc-cut], [data-cc-source]'), null)
  assert.equal(titles[0].textContent, '探索未至之境')
  assert.equal(titles[1].hasAttribute('aria-label'), false)
})

test('a headline past the cap stays one text node', () => {
  const long = '标'.repeat(TITLE_CUT_MAX + 1)
  const documentRef = dom(`<div><h1 data-cc-hero-title>${long}</h1></div>`)
  syncCollage(documentRef, 0)
  syncCollage(documentRef, 800)
  assert.equal(documentRef.querySelector('.dsh-cc-han'), null)
  assert.equal(documentRef.querySelector('h1')?.textContent, long)
})

test('readable mode: body, headings, code, and the composer are never cut', () => {
  const documentRef = dom(`<article data-chat-flow-kind="assistant-step">
    <h2>修复建议</h2>
    <p id="body">拼贴已经稳定</p>
    <p>看 <code>npm test</code> 打开 https://example.com/docs 即可</p>
  </article>
  <form data-composer-seat><textarea data-composer-input>不要拆</textarea></form>`)
  const before = documentRef.body.innerHTML
  syncCollage(documentRef, 0)
  syncCollage(documentRef, 800)
  documentRef.querySelector('#body')!.append('尾巴')
  syncCollage(documentRef, 900)
  syncCollage(documentRef, 1_600)
  assert.equal(documentRef.querySelector('.dsh-cc-han, .dsh-cc-word, [data-cc-cut]'), null)
  assert.equal(documentRef.body.innerHTML, before.replace('拼贴已经稳定', '拼贴已经稳定尾巴'))
})

test('a streaming headline waits until it settles', () => {
  const documentRef = dom('<h1 data-cc-hero-title>Into</h1>')
  const title = documentRef.querySelector('h1')!
  syncCollage(documentRef, 0)
  title.textContent = 'Into the'
  syncCollage(documentRef, 300)
  syncCollage(documentRef, 600)
  assert.equal(title.querySelector('.dsh-cc-han'), null, 'growing text is not cut mid-stream')
  syncCollage(documentRef, 900)
  assert.equal(title.textContent, 'Into the')
  assert.ok(title.querySelectorAll('.dsh-cc-han').length >= 2)
})

test('the star field keeps four v9 contours with a visible gap', () => {
  const svg = readFileSync(new URL('../assets/star-field.svg', import.meta.url), 'utf8')
  assert.match(svg, /80\.0,4\.0 101\.0,51\.1 152\.3,56\.5/)
  const marks = svg.match(/rotate\(/g) ?? []
  const blacks = svg.match(/fill="#111"/g) ?? []
  assert.ok(marks.length >= 60, `expected a dense field, got ${marks.length}`)
  assert.ok(blacks.length >= marks.length * 3, `expected three black contours per star, got ${blacks.length}`)
})
