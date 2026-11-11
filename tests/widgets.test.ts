import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { EXT, KIND, clearWidgets, fileKind, fileStamp, syncWidgets } from '../src/client/widgets.ts'

const css = readFileSync(new URL('../src/client/skin.css', import.meta.url), 'utf8')
const start = css.indexOf('* 0.5.3 widgets.')
const reduce = css.lastIndexOf('@media (prefers-reduced-motion: reduce)')
const block = css.slice(start, reduce)

/** Host-like turn tail and attachment row, with the built CSS-module class names. */
function page() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div class="LOmM4q_attachmentRow"><div class="LOmM4q_fileCard"><span class="LOmM4q_fileIcon"><svg></svg></span>
      <div class="LOmM4q_fileContent"><span class="LOmM4q_fileName">before-atrium.png</span><span class="LOmM4q_fileMeta">PNG · 1.2 MB</span></div></div></div>
    <div class="K5rwea_presented">
      <div class="K5rwea_file" data-presented-file="true"><button class="K5rwea_cardPreview" aria-label="预览 atrium-notes.md"></button>
        <span class="K5rwea_fileIcon"><svg></svg></span><div class="K5rwea_fileBody"><div class="K5rwea_details">
        <span class="K5rwea_fileName">atrium-notes.md</span><span class="K5rwea_description">中庭改造说明</span></div></div></div>
      <div class="K5rwea_file" data-presented-file="true"><span class="K5rwea_fileIcon"><svg></svg></span>
        <span class="K5rwea_fileName">Makefile</span></div>
      <div class="K5rwea_file" data-presented-file="true"><span class="K5rwea_fileIcon"></span>
        <span class="K5rwea_fileName">src/app/main.tsx</span></div>
    </div></body></html>`)
  return dom.window.document
}

test('file stamps: short upper-case extension, kind by family', () => {
  assert.equal(fileStamp('atrium-notes.md'), 'MD')
  assert.equal(fileStamp('C:\\work\\after-atrium.PNG'), 'PNG')
  assert.equal(fileStamp('archive.tar.gz'), 'GZ')
  assert.equal(fileStamp('data.parquet'), 'PARQ')
  assert.equal(fileStamp('Makefile'), '')
  assert.equal(fileStamp('.env'), '')
  assert.equal(fileStamp('trailing.'), '')
  assert.equal(fileKind('MD'), 'doc')
  assert.equal(fileKind('PNG'), 'image')
  assert.equal(fileKind('TSX'), 'code')
  assert.equal(fileKind('CSV'), 'data')
  assert.equal(fileKind('FILE'), 'file')
})

test('sync stamps every presented file and attachment, idempotent; clear removes every mark', () => {
  const doc = page()
  assert.equal(syncWidgets(doc), 4)
  const icons = Array.from(doc.querySelectorAll('[class*="_fileIcon"]')).map((node) => node.getAttribute(EXT))
  assert.deepEqual(icons, ['PNG', 'MD', 'FILE', 'TSX'])
  const kinds = Array.from(doc.querySelectorAll('[data-presented-file], [class*="_fileCard"]')).map((node) => node.getAttribute(KIND))
  assert.deepEqual(kinds, ['image', 'doc', 'file', 'code'])
  // The host's own icon and text stay in the DOM (CSS only hides the svg).
  assert.equal(doc.querySelectorAll('[class*="_fileIcon"] svg').length, 3)
  assert.equal(doc.querySelector('.K5rwea_fileName')?.textContent, 'atrium-notes.md')
  const before = doc.body.innerHTML
  syncWidgets(doc)
  assert.equal(doc.body.innerHTML, before)
  // A renamed file restamps.
  doc.querySelectorAll('.K5rwea_fileName')[0]!.textContent = 'atrium.json'
  syncWidgets(doc)
  assert.equal(doc.querySelectorAll('.K5rwea_fileIcon')[0]!.getAttribute(EXT), 'JSON')
  clearWidgets(doc)
  assert.equal(doc.querySelectorAll(`[${EXT}], [${KIND}]`).length, 0)
})

test('0.5.3 CSS: every requested widget is covered and sits before the reduced-motion switch', () => {
  assert.ok(start > 0 && start < reduce)
  for (const selector of [
    '[data-presented-file]', '[class*="_fileIcon"][data-cc-ext]', 'content: attr(data-cc-ext)', '[class*="_fileCard"]',
    '[data-open-target] > button', '[data-open-path-more]', '[data-turn-trigger] > button', '[data-turn-trigger] > button > time',
    'span[class$="_stopped"]', '[class*="_turnErrorRow"]', '[class*="_turnErrorTitle"]', '[class*="_turnErrorMessage"]',
    '[data-code-block-banner]', '[data-terminal]', '[class*="_copyButton"]', '[class*="_diffAdded"]', '[class*="_errorSummary"]',
    '[data-approval-key]', 'span[class*="_dot_"][data-state]', '[class*="_spinner_"]', 'a[href]',
  ]) assert.ok(block.includes(selector), selector)
  // The "stopped" stamp must not catch the tool row's "_stoppedSummary".
  assert.doesNotMatch(block, /class\*="_stopped"\]/)
  // Reading text keeps a plain face and readable size/contrast.
  assert.match(block, /\[class\*="_turnErrorMessage"\] \{[^}]*color: #ececec !important;[^}]*font-size: 13\.5px;/)
  assert.match(block, /\[data-presented-file\] \[class\*="_description"\] \{[^}]*font-size: 12px !important;[^}]*color: #3d3d3d !important;/)
  assert.match(block, /\[data-turn-trigger\] > \[class\*="_body"\] \{[^}]*background: #f7f4ee;[^}]*color: #1b1b1b !important;/)
  // Hollow numerals for the trigger time; the chevron animates on open.
  assert.match(block, /> time \{[^}]*color: transparent !important;[^}]*-webkit-text-stroke:/)
  assert.match(block, /\[aria-expanded="true"\] > svg:last-child \{[^}]*animation: dsh-cc-w-chev/)
  // No flashing: nothing here touches opacity or stepped timing.
  assert.doesNotMatch(block, /opacity|steps\(/)
  // Entry animations never hold their end frame (so hover lunges still work).
  for (const use of block.matchAll(/animation: (dsh-cc-w-(?:in|slam)) [^;]*;/g)) assert.match(use[0], /backwards;$/, use[1])
  // Hover lunges are frozen by the reduced-motion switch.
  const tail = css.slice(reduce)
  for (const selector of ['[data-presented-file]', '[data-open-target] > button', '[data-turn-trigger] > button', 'span[class$="_stopped"]']) {
    assert.ok(tail.includes(selector), selector)
  }
})

test('morph and letters: widgets get the red plate on hover and never get collage-cut', () => {
  const morph = readFileSync(new URL('../src/client/morph.ts', import.meta.url), 'utf8')
  for (const selector of ['[data-presented-file]', '[data-open-target] button', '[data-turn-trigger] > button', '[data-code-block-banner] button', '[data-approval-key] [class*="_actionRow"] button']) {
    assert.ok(morph.includes(selector), selector)
  }
  const letters = readFileSync(new URL('../src/client/letters.ts', import.meta.url), 'utf8')
  for (const selector of ['[data-turn-trigger]', '[data-presented-file]', '[data-approval-key]', '[data-terminal]', '[data-code-block-banner]', '[data-tool]']) {
    assert.ok(letters.includes(selector), selector)
  }
})
