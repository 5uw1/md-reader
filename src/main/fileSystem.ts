import { promises as fs } from 'fs'
import { basename, extname, join } from 'path'
import type { FileTreeNode, OpenPathResult, StatResult } from '../shared/types'

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd'])
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg'])

export async function statPath(targetPath: string): Promise<StatResult> {
  try {
    const stat = await fs.stat(targetPath)
    return { exists: true, isDirectory: stat.isDirectory() }
  } catch {
    return { exists: false, isDirectory: false }
  }
}

function isMarkdownFile(name: string): boolean {
  return MD_EXTENSIONS.has(extname(name).toLowerCase())
}

/**
 * Recursively walks a directory, keeping only .md files and directories
 * that (transitively) contain at least one .md file.
 */
async function walk(dirPath: string): Promise<FileTreeNode | null> {
  const name = basename(dirPath)
  if (SKIP_DIRS.has(name) || name.startsWith('.')) return null

  let entries
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return null
  }

  const children: FileTreeNode[] = []
  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      const child = await walk(entryPath)
      if (child) children.push(child)
    } else if (entry.isFile() && isMarkdownFile(entry.name)) {
      children.push({ name: entry.name, path: entryPath, type: 'file' })
    }
  }

  if (children.length === 0) return null

  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return { name, path: dirPath, type: 'dir', children }
}

export async function scanFolder(rootPath: string): Promise<FileTreeNode> {
  const tree = await walk(rootPath)
  return tree ?? { name: basename(rootPath), path: rootPath, type: 'dir', children: [] }
}

function findDefaultFile(node: FileTreeNode): string | undefined {
  if (!node.children) return undefined

  const readme = node.children.find(
    (c) => c.type === 'file' && /^readme\.(md|markdown|mdown|mkd)$/i.test(c.name)
  )
  if (readme) return readme.path

  for (const child of node.children) {
    if (child.type === 'file') return child.path
  }
  for (const child of node.children) {
    if (child.type === 'dir') {
      const found = findDefaultFile(child)
      if (found) return found
    }
  }
  return undefined
}

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

export async function resolveOpenPath(targetPath: string): Promise<OpenPathResult | null> {
  const stat = await statPath(targetPath)
  if (!stat.exists) return null

  if (stat.isDirectory) {
    const tree = await scanFolder(targetPath)
    return {
      kind: 'folder',
      rootPath: targetPath,
      tree,
      defaultFilePath: findDefaultFile(tree)
    }
  }

  if (!isMarkdownFile(targetPath)) return null
  return { kind: 'file', rootPath: targetPath, defaultFilePath: targetPath }
}
