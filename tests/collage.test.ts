import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { TITLE_CUT_MAX, piecesFor, restoreCollage, syncCollage } from '../src/client/collage.ts'

function dom(html: string) {
  return new JSDOM(html).window.document
}

test('pieces keep the original characters in order', () => {
  const text = '打开 https://example.com/docs 看说明'
  assert.equal(piecesFor(text, 'runs').map((piece) => piece.text).join(''), text)
  assert.equal(piecesFor('Into the Unknown', 'letters').map((piece) => piece.text).join(''), 'Into the Unknown')
  const runs = piecesFor('Into the Unknown', 'runs')
  assert.deepEqual(runs.filter((piece) => piece.gap).map((piece) => piece.text), ['the', 'Unknown'])
  const faces = new Set(piecesFor('探索未至之境', 'letters').map((piece) => piece.face).filter(Boolean))
  assert.ok(faces.size >= 2)
})

test('Chinese and long English titles, plus preview tags, become mixed tiles', () => {
  const documentRef = dom(`<div data-conversation-scroll>
    <h1 data-cc-hero-title>探索未至之境</h1>
    <span data-cc-hero-tag>预览版</span>
    <h1 data-cc-hero-title>Into the Unknown</h1>
    <span data-cc-hero-tag>Preview</span>
  </div>`)
  syncCollage(documentRef, 0)
  syncCollage(documentRef, 600)
  const titles = [...documentRef.querySelectorAll('[data-cc-hero-title]')]
  assert.deepEqual(
    [...titles[0].querySelectorAll('.dsh-cc-han')].map((tile) => tile.textContent),
    [...'探索未至之境'],
  )
  assert.equal(titles[1].textContent, 'Into the Unknown')
  assert.deepEqual([...titles[1].querySelectorAll('.dsh-cc-word')].map((word) => word.textContent), ['Into', 'the', 'Unknown'])
  const englishFaces = new Set([...titles[1].querySelectorAll('.dsh-cc-han')].map((tile) => tile.getAttribute('data-cc-face')))
  assert.ok(englishFaces.has('Anton'))
  assert.ok(englishFaces.size >= 2)
  assert.deepEqual(
    [...documentRef.querySelectorAll('[data-cc-hero-tag]')].map((tag) => tag.textContent),
    ['预览版', 'Preview'],
  )
  const firstCount = titles[1].querySelectorAll('.dsh-cc-han').length
  syncCollage(documentRef, 1_200)
  assert.equal(titles[1].querySelectorAll('.dsh-cc-han').length, firstCount)
  assert.equal(titles[1].querySelector('.dsh-cc-han .dsh-cc-han'), null)
})

test('a heading past the title cap stays one text node', () => {
  const documentRef = dom(`<div data-conversation-scroll><h2>${'标'.repeat(TITLE_CUT_MAX + 1)}</h2></div>`)
  syncCollage(documentRef, 0)
  syncCollage(documentRef, 800)
  assert.equal(documentRef.querySelector('.dsh-cc-han'), null)
  assert.equal(documentRef.querySelector('h2')?.textContent, '标'.repeat(TITLE_CUT_MAX + 1))
})

test('streamed append, replacement, selection, and copy stay single and reversible', () => {
  const documentRef = dom(`<article data-chat-flow-kind="assistant-step">
    <p id="body">拼贴已经稳定</p>
    <p id="code">看 <code>npm test</code> 这里</p>
    <p id="link">打开 https://example.com/docs 即可</p>
  </article>
  <form data-composer-seat><textarea data-composer-input>不要拆</textarea></form>`)
  const body = documentRef.querySelector('#body')
  assert.ok(body)
  syncCollage(documentRef, 0)
  body.firstChild!.textContent = '拼贴已经稳定呀'
  syncCollage(documentRef, 200)
  assert.equal(body.querySelector('.dsh-cc-run'), null, 'growing text is not cut mid-stream')

  syncCollage(documentRef, 800)
  const painted = body.querySelectorAll('.dsh-cc-run').length
  assert.ok(painted >= 2)
  const faces = new Set([...body.querySelectorAll('.dsh-cc-run')].map((run) => run.getAttribute('data-cc-face')))
  assert.ok(faces.size >= 2)
  assert.equal(body.textContent, '拼贴已经稳定呀')

  body.append('尾巴')
  syncCollage(documentRef, 900)
  assert.equal(body.querySelectorAll('.dsh-cc-run').length, painted)
  assert.equal(body.textContent, '拼贴已经稳定呀尾巴')
  syncCollage(documentRef, 1_500)
  assert.equal(body.textContent, '拼贴已经稳定呀尾巴')
  assert.ok(body.querySelectorAll('.dsh-cc-run').length > painted)

  body.textContent = '换成新的正文'
  syncCollage(documentRef, 1_600)
  assert.equal(body.querySelector('.dsh-cc-run'), null)
  syncCollage(documentRef, 2_200)
  assert.equal(body.textContent, '换成新的正文')
  assert.equal(body.querySelector('.dsh-cc-run .dsh-cc-run'), null)

  const again = body.querySelectorAll('.dsh-cc-run').length
  const selection = documentRef.getSelection()
  assert.ok(selection)
  const range = documentRef.createRange()
  range.selectNodeContents(body)
  selection.removeAllRanges()
  selection.addRange(range)
  body.append('选中时不切')
  syncCollage(documentRef, 3_000)
  assert.equal(body.querySelectorAll('.dsh-cc-run').length, again)
  assert.equal(body.textContent, '换成新的正文选中时不切')
  selection.removeAllRanges()

  const code = documentRef.querySelector('code')
  assert.equal(code?.textContent, 'npm test')
  assert.equal(code?.querySelector('.dsh-cc-run'), null)
  assert.equal(documentRef.querySelector('.dsh-cc-url')?.textContent, 'https://example.com/docs')
  assert.equal(documentRef.querySelector('textarea')?.textContent, '不要拆')
  assert.equal(documentRef.querySelector('[data-composer-seat] .dsh-cc-run'), null)

  restoreCollage(documentRef)
  assert.equal(body.textContent, '换成新的正文选中时不切')
  assert.equal(documentRef.querySelector('.dsh-cc-run, .dsh-cc-han, .dsh-cc-url'), null)
})

test('the star field keeps four v9 contours with a visible gap', () => {
  const svg = readFileSync(new URL('../assets/star-field.svg', import.meta.url), 'utf8')
  assert.match(svg, /80\.0,4\.0 101\.0,51\.1 152\.3,56\.5/)
  const marks = svg.match(/rotate\(/g) ?? []
  const blacks = svg.match(/fill="#111"/g) ?? []
  assert.ok(marks.length >= 60, `expected a dense field, got ${marks.length}`)
  assert.ok(blacks.length >= marks.length * 3, `expected three black contours per star, got ${blacks.length}`)
})
