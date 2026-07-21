import { app, shell, BrowserWindow, ipcMain, dialog, Menu, type MenuItemConstructorOptions } from 'electron'
import { promises as fs } from 'fs'
import { basename, dirname, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readFile, resolveOpenPath, scanFolder, statPath } from './fileSystem'
import { addRecent, clearRecent, loadRecent, removeRecent, type RecentEntry } from './recentFiles'
import type { OpenPathResult, ThemeMode, ViewMode } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let currentTheme: ThemeMode = 'system'
let currentViewMode: ViewMode = 'preview'
let currentFilePath: string | null = null
let isDirty = false
let recentEntries: RecentEntry[] = []

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 840,
    minWidth: 720,
    minHeight: 480,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function resolveOpenPathAndRecord(targetPath: string): Promise<OpenPathResult | null> {
  const result = await resolveOpenPath(targetPath)
  if (result) {
    recentEntries = await addRecent(result.rootPath, result.kind)
    buildMenu()
  }
  return result
}

async function openFileDialog() {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Markdown File',
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return resolveOpenPathAndRecord(result.filePaths[0])
}

async function openFolderDialog() {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Folder',
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return resolveOpenPathAndRecord(result.filePaths[0])
}

async function openRecentEntry(entry: RecentEntry): Promise<void> {
  const result = await resolveOpenPathAndRecord(entry.path)
  if (!result) {
    recentEntries = await removeRecent(entry.path)
    buildMenu()
    dialog.showErrorBox('Cannot Open', `"${entry.path}" no longer exists.`)
    return
  }
  mainWindow?.webContents.send('menu:open-result', result)
}

async function clearRecentFromMenu(): Promise<void> {
  recentEntries = await clearRecent()
  buildMenu()
}

async function openFileDialogFromMenu(): Promise<void> {
  const openResult = await openFileDialog()
  if (openResult) mainWindow?.webContents.send('menu:open-result', openResult)
}

async function openFolderDialogFromMenu(): Promise<void> {
  const openResult = await openFolderDialog()
  if (openResult) mainWindow?.webContents.send('menu:open-result', openResult)
}

function setThemeFromMenu(theme: ThemeMode): void {
  currentTheme = theme
  mainWindow?.webContents.send('theme:set', theme)
  buildMenu()
}

function setViewModeFromMenu(mode: ViewMode): void {
  currentViewMode = mode
  mainWindow?.webContents.send('viewmode:set', mode)
  buildMenu()
}

function requestSaveFromMenu(): void {
  mainWindow?.webContents.send('menu:save-request')
}

async function exportCurrentToPdf(): Promise<void> {
  if (!mainWindow || !currentFilePath) return

  const defaultName = `${basename(currentFilePath).replace(/\.(md|markdown|mdown|mkd)$/i, '')}.pdf`
  const saveResult = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as PDF',
    defaultPath: join(dirname(currentFilePath), defaultName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (saveResult.canceled || !saveResult.filePath) return

  try {
    const pdfBuffer = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    })
    await fs.writeFile(saveResult.filePath, pdfBuffer)
    shell.showItemInFolder(saveResult.filePath)
  } catch (err) {
    dialog.showErrorBox('Export as PDF failed', (err as Error).message)
  }
}

function buildMenu(): void {
  const recentSubmenu: MenuItemConstructorOptions[] =
    recentEntries.length === 0
      ? [{ label: 'No Recently Opened Files', enabled: false }]
      : [
          ...recentEntries.map(
            (entry): MenuItemConstructorOptions => ({
              label: entry.kind === 'folder' ? `${entry.name} (Folder)` : entry.name,
              click: () => openRecentEntry(entry)
            })
          ),
          { type: 'separator' },
          { label: 'Clear Recently Opened', click: () => clearRecentFromMenu() }
        ]

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: () => openFileDialogFromMenu() },
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: () => openFolderDialogFromMenu() },
        { label: 'Open Recent', submenu: recentSubmenu },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: !!currentFilePath && isDirty,
          click: () => requestSaveFromMenu()
        },
        { type: 'separator' },
        {
          label: 'Export as PDF…',
          accelerator: 'CmdOrCtrl+P',
          enabled: !!currentFilePath,
          click: () => exportCurrentToPdf()
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        {
          label: 'Theme',
          submenu: [
            {
              label: 'Match System',
              type: 'radio',
              checked: currentTheme === 'system',
              click: () => setThemeFromMenu('system')
            },
            {
              label: 'Light',
              type: 'radio',
              checked: currentTheme === 'light',
              click: () => setThemeFromMenu('light')
            },
            {
              label: 'Dark',
              type: 'radio',
              checked: currentTheme === 'dark',
              click: () => setThemeFromMenu('dark')
            }
          ]
        },
        {
          label: 'View Mode',
          submenu: [
            {
              label: 'Preview',
              type: 'radio',
              checked: currentViewMode === 'preview',
              click: () => setViewModeFromMenu('preview')
            },
            {
              label: 'Edit',
              type: 'radio',
              checked: currentViewMode === 'edit',
              click: () => setViewModeFromMenu('edit')
            },
            {
              label: 'Split',
              type: 'radio',
              checked: currentViewMode === 'split',
              click: () => setViewModeFromMenu('split')
            }
          ]
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.mdreader.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  recentEntries = await loadRecent()

  ipcMain.handle('fs:statPath', (_event, targetPath: string) => statPath(targetPath))
  ipcMain.handle('fs:scanFolder', (_event, rootPath: string) => scanFolder(rootPath))
  ipcMain.handle('fs:readFile', (_event, filePath: string) => readFile(filePath))
  ipcMain.handle('fs:writeFile', (_event, filePath: string, content: string) =>
    fs.writeFile(filePath, content, 'utf-8')
  )
  ipcMain.handle('fs:resolveOpenPath', (_event, targetPath: string) => resolveOpenPathAndRecord(targetPath))
  ipcMain.handle('dialog:openFile', () => openFileDialog())
  ipcMain.handle('dialog:openFolder', () => openFolderDialog())
  ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(url))
  ipcMain.on('theme:report', (_event, theme: ThemeMode) => {
    currentTheme = theme
    buildMenu()
  })
  ipcMain.on('file:report-current', (_event, filePath: string | null) => {
    currentFilePath = filePath
    buildMenu()
  })
  ipcMain.on('viewmode:report', (_event, mode: ViewMode) => {
    currentViewMode = mode
    buildMenu()
  })
  ipcMain.on('file:report-dirty', (_event, dirty: boolean) => {
    isDirty = dirty
    buildMenu()
  })

  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
