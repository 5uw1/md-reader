import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { FileTreeNode, OpenPathResult, StatResult, ThemeMode, ViewMode } from '../shared/types'

const api = {
  statPath: (targetPath: string): Promise<StatResult> => ipcRenderer.invoke('fs:statPath', targetPath),
  scanFolder: (rootPath: string): Promise<FileTreeNode> => ipcRenderer.invoke('fs:scanFolder', rootPath),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),
  resolveOpenPath: (targetPath: string): Promise<OpenPathResult | null> =>
    ipcRenderer.invoke('fs:resolveOpenPath', targetPath),
  openFileDialog: (): Promise<OpenPathResult | null> => ipcRenderer.invoke('dialog:openFile'),
  openFolderDialog: (): Promise<OpenPathResult | null> => ipcRenderer.invoke('dialog:openFolder'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  onMenuOpen: (callback: (result: OpenPathResult) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: OpenPathResult): void => callback(result)
    ipcRenderer.on('menu:open-result', listener)
    return () => ipcRenderer.removeListener('menu:open-result', listener)
  },
  reportTheme: (theme: ThemeMode): void => ipcRenderer.send('theme:report', theme),
  onThemeSet: (callback: (theme: ThemeMode) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: ThemeMode): void => callback(theme)
    ipcRenderer.on('theme:set', listener)
    return () => ipcRenderer.removeListener('theme:set', listener)
  },
  reportCurrentFile: (filePath: string | null): void => ipcRenderer.send('file:report-current', filePath),
  reportViewMode: (mode: ViewMode): void => ipcRenderer.send('viewmode:report', mode),
  onViewModeSet: (callback: (mode: ViewMode) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, mode: ViewMode): void => callback(mode)
    ipcRenderer.on('viewmode:set', listener)
    return () => ipcRenderer.removeListener('viewmode:set', listener)
  },
  reportDirty: (dirty: boolean): void => ipcRenderer.send('file:report-dirty', dirty),
  onSaveRequested: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('menu:save-request', listener)
    return () => ipcRenderer.removeListener('menu:save-request', listener)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
