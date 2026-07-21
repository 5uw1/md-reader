function dirname(p: string): string {
  const normalized = p.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx === -1 ? '' : normalized.slice(0, idx)
}

export function baseName(p: string): string {
  const normalized = p.replace(/\\/g, '/')
  return normalized.slice(normalized.lastIndexOf('/') + 1)
}

export function isExternalTarget(target: string): boolean {
  return (
    /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ||
    target.startsWith('mailto:') ||
    target.startsWith('data:') ||
    target.startsWith('#')
  )
}

/** Resolves a relative markdown link/image target against the directory of the file it appears in. */
export function resolveRelativePath(baseFilePath: string, target: string): string {
  if (isExternalTarget(target)) return target

  const cleanTarget = target.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(cleanTarget) || cleanTarget.startsWith('/')) return cleanTarget

  const base = dirname(baseFilePath)
  const combined = `${base}/${cleanTarget}`
  const isWindowsAbs = /^[a-zA-Z]:/.test(combined)
  const segments = combined.split('/')
  const stack: string[] = []
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') stack.pop()
    else stack.push(segment)
  }
  return (isWindowsAbs ? '' : '/') + stack.join('/')
}

export function toFileUrl(absPath: string): string {
  const normalized = absPath.replace(/\\/g, '/')
  const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  return `file://${encodeURI(withSlash)}`
}

const MD_EXT_RE = /\.(md|markdown|mdown|mkd)$/i

export function isMarkdownPath(target: string): boolean {
  return MD_EXT_RE.test(target)
}
