import { app } from 'electron'
import { promises as fs } from 'fs'
import { basename, join } from 'path'

export interface RecentEntry {
  path: string
  kind: 'file' | 'folder'
  name: string
}

const MAX_RECENT = 10

function recentFilePath(): string {
  return join(app.getPath('userData'), 'recent.json')
}

export async function loadRecent(): Promise<RecentEntry[]> {
  try {
    const raw = await fs.readFile(recentFilePath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveRecent(entries: RecentEntry[]): Promise<void> {
  await fs.writeFile(recentFilePath(), JSON.stringify(entries, null, 2), 'utf-8')
}

export async function addRecent(path: string, kind: 'file' | 'folder'): Promise<RecentEntry[]> {
  const existing = await loadRecent()
  const next = [{ path, kind, name: basename(path) }, ...existing.filter((e) => e.path !== path)].slice(
    0,
    MAX_RECENT
  )
  await saveRecent(next)
  return next
}

export async function removeRecent(path: string): Promise<RecentEntry[]> {
  const next = (await loadRecent()).filter((e) => e.path !== path)
  await saveRecent(next)
  return next
}

export async function clearRecent(): Promise<RecentEntry[]> {
  await saveRecent([])
  return []
}
