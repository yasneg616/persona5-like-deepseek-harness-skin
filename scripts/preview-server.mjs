import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'

const port = Number(process.env.PORT || 43123)
const root = process.cwd()
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
}

const routes = new Map([
  ['/', 'preview/index.html'],
  ['/fixture.js', 'preview/fixture.js'],
  ['/skin.css', 'lib/skin.css'],
  ['/client.js', 'lib/client.js'],
  ['/conversation.html', 'preview/conversation.html'],
  ['/desktop.html', 'preview/desktop.html'],
  ['/menus.html', 'preview/menus.html'],
  ['/widgets.html', 'preview/widgets.html'],
  ['/lib/skin.css', 'lib/skin.css'],
  ['/lib/client.js', 'lib/client.js'],
  ['/lib/fixture-boot.js', 'lib/fixture-boot.js'],
  ['/fixture-boot.js', 'lib/fixture-boot.js'],
])

if (!existsSync(join(root, 'lib/client.js'))) {
  console.error('lib/client.js is missing. Run npm run build first.')
  process.exit(1)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const file = routes.get(url.pathname)
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found')
    return
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
  createReadStream(join(root, file)).pipe(res)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`preview http://127.0.0.1:${server.address().port}`)
})
