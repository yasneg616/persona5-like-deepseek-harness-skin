import { syncCollage } from './collage.ts'
import { cutoutFor } from './cutouts.ts'

const field = document.querySelector('.dsh-cc-field')
if (field) {
  const arch = document.createElement('div')
  arch.className = 'dsh-cc-architecture'
  arch.setAttribute('role', 'img')
  arch.setAttribute('aria-label', 'DEEPSEEK HARNESS')
  for (const word of ['DEEPSEEK', 'HARNESS']) {
    const line = document.createElement('div')
    line.className = 'dsh-cc-line'
    for (const letter of cutoutFor(word)) {
      const tile = document.createElement('span')
      tile.className = `dsh-cc-letter dsh-cc-shape-${letter.shape}${letter.reverse ? ' is-reversed' : ''}`
      tile.style.setProperty('--slot', `${letter.w}em`)
      tile.style.setProperty('--face', letter.face)
      tile.style.setProperty('--letter-size', `${letter.size}em`)
      tile.style.setProperty('--letter-x', String(letter.sx))
      tile.style.setProperty('--tilt', `${letter.rot}deg`)
      tile.style.setProperty('--lift', `${letter.y}em`)
      tile.style.setProperty('--paper-height', `${letter.h}em`)
      const glyph = document.createElement('span')
      glyph.className = 'dsh-cc-glyph'
      glyph.textContent = letter.c
      tile.append(glyph)
      line.append(tile)
    }
    arch.append(line)
  }
  const tag = document.createElement('i')
  tag.className = 'dsh-cc-tagline'
  tag.textContent = 'TAKE YOUR HEART'
  arch.append(tag)
  field.replaceChildren(arch)
}

syncCollage(document, 1_000)
syncCollage(document, 1_600)

const stream = document.querySelector('[data-cc-stream]')
if (stream) {
  stream.append('尾巴还在长')
  syncCollage(document, 1_700)
  syncCollage(document, 2_400)
}
