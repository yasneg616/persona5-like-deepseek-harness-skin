/**
 * File-type stamps for the host's file cards.
 *
 * Presented files (`[data-presented-file]`) and message attachments
 * (`*_fileCard`) carry a generic file icon. The stylesheet draws a bold
 * calling-card stamp instead; this module only reads the visible file name
 * and writes two attributes:
 *   - `data-cc-ext`  on the icon box (`MD`, `PNG`, ...);
 *   - `data-cc-kind` on the card (`doc`, `image`, `code`, `data`, `file`).
 * Nothing else is read or stored. Removed on unload.
 */
export const EXT = 'data-cc-ext'
export const KIND = 'data-cc-kind'
export const CARD = '[data-presented-file], [class*="_fileCard"]'
const NAME = '[class*="_fileName"]'
const ICON = '[class*="_fileIcon"]'

const KINDS: Record<string, string> = {}
for (const ext of ['md', 'markdown', 'txt', 'pdf', 'doc', 'docx', 'rtf', 'ppt', 'pptx', 'key', 'pages', 'odt', 'tex', 'rst']) KINDS[ext] = 'doc'
for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'heic', 'tif', 'tiff', 'psd']) KINDS[ext] = 'image'
for (const ext of ['json', 'csv', 'tsv', 'xls', 'xlsx', 'yaml', 'yml', 'toml', 'xml', 'sql', 'db', 'sqlite', 'parquet', 'ndjson']) KINDS[ext] = 'data'
for (const ext of ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rs', 'go', 'java', 'kt', 'c', 'h', 'cpp', 'cc', 'hpp', 'cs', 'rb', 'php', 'swift', 'sh', 'ps1', 'bat', 'css', 'scss', 'html', 'vue', 'lua', 'r', 'dart', 'zig']) KINDS[ext] = 'code'

/** Extension stamp for a file name: at most 4 letters, upper case; '' when there is none. */
export function fileStamp(name: string): string {
  const base = name.trim().split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  const ext = base.slice(dot + 1).replace(/[^\p{L}\p{N}]/gu, '')
  return ext.slice(0, 4).toUpperCase()
}

export function fileKind(stamp: string): string {
  return KINDS[stamp.toLowerCase()] ?? 'file'
}

export function syncWidgets(documentRef: Document): number {
  let count = 0
  for (const card of Array.from(documentRef.querySelectorAll(CARD))) {
    const name = card.querySelector(NAME)?.textContent ?? ''
    const stamp = fileStamp(name) || 'FILE'
    const kind = fileKind(stamp)
    if (card.getAttribute(KIND) !== kind) card.setAttribute(KIND, kind)
    const icon = card.querySelector(ICON)
    if (icon && icon.getAttribute(EXT) !== stamp) icon.setAttribute(EXT, stamp)
    count += 1
  }
  return count
}

export function clearWidgets(documentRef: Document): void {
  for (const node of Array.from(documentRef.querySelectorAll(`[${EXT}], [${KIND}]`))) {
    node.removeAttribute(EXT)
    node.removeAttribute(KIND)
  }
}
