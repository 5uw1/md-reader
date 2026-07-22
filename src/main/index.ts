import { app, shell, BrowserWindow, ipcMain, dialog, Menu, type MenuItemConstructorOptions } from 'electron'
import { promises as fs } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readFile, resolveOpenPath, scanFolder, statPath } from './fileSystem'
import { addRecent, clearRecent, loadRecent, removeRecent, type RecentEntry } from './recentFiles'
import type { OpenPathResult, ThemeMode, ViewMode } from '../shared/types'

const execFileAsync = promisify(execFile)
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd'])
const MARKDOWN_PROG_ID = 'MDReader.Markdown'

let mainWindow: BrowserWindow | null = null
let currentTheme: ThemeMode = 'system'
let currentViewMode: ViewMode = 'preview'
let currentFilePath: string | null = null
let isDirty = false
let recentEntries: RecentEntry[] = []

/** Picks the markdown file path (if any) out of argv passed by Windows on
 *  launch — e.g. double-clicking a .md file, or "Open with" > MD Reader. */
function extractMarkdownArg(argv: string[]): string | undefined {
  return argv.slice(1).find((arg) => MARKDOWN_EXTENSIONS.has(extname(arg).toLowerCase()))
}

async function openPathOnLaunch(targetPath: string): Promise<void> {
  const result = await resolveOpenPathAndRecord(targetPath)
  if (result) mainWindow?.webContents.send('menu:open-result', result)
}

async function registerFileAssociation(): Promise<void> {
  if (process.platform !== 'win32') return
  const exePath = process.execPath
  try {
    await execFileAsync('reg', [
      'add',
      `HKCU\\Software\\Classes\\${MARKDOWN_PROG_ID}`,
      '/ve',
      '/d',
      'Markdown Document',
      '/f'
    ])
    await execFileAsync('reg', [
      'add',
      `HKCU\\Software\\Classes\\${MARKDOWN_PROG_ID}\\DefaultIcon`,
      '/ve',
      '/d',
      `${exePath},0`,
      '/f'
    ])
    await execFileAsync('reg', [
      'add',
      `HKCU\\Software\\Classes\\${MARKDOWN_PROG_ID}\\shell\\open\\command`,
      '/ve',
      '/d',
      `"${exePath}" "%1"`,
      '/f'
    ])
    for (const ext of MARKDOWN_EXTENSIONS) {
      await execFileAsync('reg', [
        'add',
        `HKCU\\Software\\Classes\\${ext}\\OpenWithProgids`,
        '/v',
        MARKDOWN_PROG_ID,
        '/d',
        '',
        '/f'
      ])
    }
    if (mainWindow) {
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'MD Reader',
        message: 'Added to the right-click "Open with" menu for Markdown files.'
      })
    }
  } catch (err) {
    dialog.showErrorBox('Could not register file association', (err as Error).message)
  }
}

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

async function newFileDialog(defaultDir?: string): Promise<string | null> {
  if (!mainWindow) return null
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'New Markdown File',
    defaultPath: join(defaultDir ?? app.getPath('documents'), 'Untitled.md'),
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (result.canceled || !result.filePath) return null

  const filePath = /\.[^/\\]+$/.test(result.filePath) ? result.filePath : `${result.filePath}.md`
  await fs.writeFile(filePath, '', 'utf-8')
  recentEntries = await addRecent(filePath, 'file')
  buildMenu()
  return filePath
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

function requestNewFileFromMenu(): void {
  mainWindow?.webContents.send('menu:new-file-request')
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
        { label: 'New File…', accelerator: 'CmdOrCtrl+N', click: () => requestNewFileFromMenu() },
        { type: 'separator' },
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
        ...(process.platform === 'win32'
          ? [
              {
                label: 'Add to "Open With" Menu…',
                click: () => void registerFileAssociation()
              } as MenuItemConstructorOptions,
              { type: 'separator' as const }
            ]
          : []),
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

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  // A second launch (e.g. double-clicking another .md file, or "Open with" while
  // already running) shows up here instead of spawning a second window.
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    const filePath = extractMarkdownArg(argv)
    if (filePath) void openPathOnLaunch(filePath)
  })

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
    ipcMain.handle('dialog:newFile', (_event, defaultDir?: string) => newFileDialog(defaultDir))
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

    const initialFilePath = extractMarkdownArg(process.argv)
    if (initialFilePath) {
      mainWindow?.webContents.once('did-finish-load', () => {
        void openPathOnLaunch(initialFilePath)
      })
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
