export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileTreeNode[]
}

export interface StatResult {
  exists: boolean
  isDirectory: boolean
}

export interface OpenPathResult {
  kind: 'file' | 'folder'
  rootPath: string
  tree?: FileTreeNode
  defaultFilePath?: string
}

export type ThemeMode = 'system' | 'light' | 'dark'

export type ViewMode = 'preview' | 'edit' | 'split'

export interface HeadingInfo {
  id: string
  text: string
  level: number
}
