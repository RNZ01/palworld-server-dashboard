import { rmSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, basename, relative, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'

const siteDir = '.pagefind-site'
const contentDir = 'content'

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function textFromMdx(source) {
  return source
    .replace(/^---[\s\S]*?---\s*/u, '')
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/^#+\s*/gmu, '')
    .replace(/[*_~>#|`-]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function titleFromMdx(source, fallback) {
  return source.match(/^title:\s*(.+)$/mu)?.[1]?.trim() || source.match(/^#\s+(.+)$/mu)?.[1]?.trim() || fallback
}

function routeFromFile(file) {
  const rel = relative(contentDir, file).replace(/\.mdx$/u, '')
  return rel === 'index' ? '/docs' : `/docs/${rel.replace(/\/index$/u, '').replaceAll('\\', '/')}`
}

function writePage(route, title, body) {
  const outDir = route === '/docs' ? join(siteDir, 'docs') : join(siteDir, route.replace(/^\//u, ''))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    join(outDir, 'index.html'),
    `<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body><main data-pagefind-body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p></main></body></html>`
  )
}

rmSync(siteDir, { recursive: true, force: true })
rmSync('public/_pagefind', { recursive: true, force: true })

for (const file of walk(contentDir)) {
  if (!file.endsWith('.mdx')) continue
  const source = readFileSync(file, 'utf8')
  const fallback = basename(file, '.mdx') === 'index' ? basename(dirname(file)) : basename(file, '.mdx')
  writePage(routeFromFile(file), titleFromMdx(source, fallback), textFromMdx(source))
}

execFileSync(
  process.execPath,
  [join('node_modules', 'pagefind', 'lib', 'runner', 'bin.cjs'), '--site', siteDir, '--output-path', 'public/_pagefind'],
  { stdio: 'inherit' }
)
