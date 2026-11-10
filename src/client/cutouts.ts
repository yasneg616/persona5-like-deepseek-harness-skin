/** Per-letter paper tiles for the architectural SESSION word only. */
export interface LetterCut {
  c: string
  w: number
  face: string
  size: number
  sx: number
  rot: number
  y: number
  h: number
  reverse: boolean
  shape: number
}

export const SESSION_CUTOUT: readonly LetterCut[] = [
  { c: 'S', w: 0.43643, face: 'Anton', size: 0.96, sx: 0.8571, rot: -3, y: -0.015, h: 0.95, reverse: false, shape: 0 },
  { c: 'E', w: 0.38662, face: 'ArchivoBlack', size: 1.13, sx: 0.4123, rot: 4, y: 0.025, h: 0.84, reverse: true, shape: 1 },
  { c: 'S', w: 0.43643, face: 'AbrilFatface', size: 1.18, sx: 0.5363, rot: -4, y: -0.025, h: 0.93, reverse: false, shape: 2 },
  { c: 'S', w: 0.43643, face: 'Anton', size: 0.94, sx: 0.8754, rot: 2, y: 0.025, h: 0.87, reverse: false, shape: 0 },
  { c: 'I', w: 0.20156, face: 'ArchivoBlack', size: 1.17, sx: 0.3853, rot: -2, y: -0.01, h: 0.95, reverse: true, shape: 1 },
  { c: 'O', w: 0.46133, face: 'AbrilFatface', size: 1.14, sx: 0.4707, rot: 3, y: 0.015, h: 0.89, reverse: false, shape: 2 },
  { c: 'N', w: 0.47305, face: 'Anton', size: 0.98, sx: 0.8432, rot: -3, y: -0.02, h: 0.96, reverse: false, shape: 0 },
]

export function sessionWordWidth(): number {
  return SESSION_CUTOUT.reduce((sum, letter) => sum + letter.w, 0)
}

const FACES = ['Anton', 'ArchivoBlack', 'AbrilFatface'] as const

/** Same tile grammar as SESSION: mixed face, paper, small tilt. Slots stay wider than the scaled glyph. */
const BRAND_WORDS: Record<string, string> = {
  DEEPSEEK: 'DEEPSEEK',
  HARNESS: 'HARNESS',
}

export function cutoutFor(word: string): LetterCut[] {
  if (word === 'SESSION') return [...SESSION_CUTOUT]
  if (word in BRAND_WORDS) return brandLine(word)
  return [...word].map((character, index) => ({
    c: character,
    w: character === 'I' || character === 'J' ? 0.24 : 0.44,
    face: FACES[index % FACES.length],
    size: 0.94 + (index % 3) * 0.08,
    sx: index % 2 === 0 ? 0.82 : 0.46,
    rot: [-3, 4, -4, 2][index % 4],
    y: [-0.015, 0.02, -0.02, 0.012][index % 4],
    h: [0.95, 0.84, 0.92, 0.88][index % 4],
    reverse: index % 2 === 1,
    shape: index % 3,
  }))
}

function brandLine(word: string): LetterCut[] {
  return [...word].map((character, index) => {
    const base = SESSION_CUTOUT[index % SESSION_CUTOUT.length]
    const narrow = character === 'I' || character === 'J'
    return {
      c: character,
      w: narrow ? 0.36 : 0.64,
      face: base.face,
      size: 0.94,
      sx: narrow ? 0.72 : 0.8,
      rot: [-2, 3, -2, 2][index % 4],
      y: base.y,
      h: base.h,
      reverse: base.reverse,
      shape: base.shape,
    }
  })
}

export function cutoutWidth(letters: readonly LetterCut[]): number {
  return letters.reduce((sum, letter) => sum + letter.w, 0)
}
