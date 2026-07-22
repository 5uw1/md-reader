import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useReducer } from 'react'
import type { FileTreeNode, HeadingInfo, OpenPathResult, ViewMode } from '../../../shared/types'

const VIEW_MODE_STORAGE_KEY = 'md-reader-viewmode'
const SHOW_TOC_STORAGE_KEY = 'md-reader-show-toc'

function getStoredViewMode(): ViewMode {
  const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY)
  return stored === 'edit' || stored === 'split' ? stored : 'preview'
}

function getStoredShowToc(): boolean {
  const stored = localStorage.getItem(SHOW_TOC_STORAGE_KEY)
  return stored === null ? true : stored === 'true'
}

interface AppState {
  mode: 'empty' | 'file' | 'folder'
  rootPath?: string
  tree?: FileTreeNode
  currentFilePath?: string
  /** Live buffer — what's shown in the editor/preview. Edited in-place while typing. */
  currentContent?: string
  /** Last content known to match what's on disk. Used to detect unsaved changes. */
  savedContent?: string
  viewMode: ViewMode
  headings: HeadingInfo[]
  showToc: boolean
  /** Heading currently at/near the top of the preview viewport, for TOC scrollspy. */
  activeHeadingId?: string
  showSearch: boolean
  searchQuery: string
  searchMatchCount: number
  currentMatchIndex: number
  loading: boolean
  error?: string
}

type Action =
  | { type: 'OPEN_START' }
  | { type: 'OPEN_RESULT'; payload: OpenPathResult }
  | { type: 'OPEN_ERROR'; message: string }
  | { type: 'SELECT_FILE_START' }
  | { type: 'SELECT_FILE_SUCCESS'; path: string; content: string }
  | { type: 'SELECT_FILE_ERROR'; message: string }
  | { type: 'SET_CONTENT'; content: string }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'SET_HEADINGS'; headings: HeadingInfo[] }
  | { type: 'SET_SHOW_TOC'; show: boolean }
  | { type: 'SET_ACTIVE_HEADING'; id: string | undefined }
  | { type: 'SET_SHOW_SEARCH'; show: boolean }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_SEARCH_MATCH_COUNT'; count: number }
  | { type: 'NEXT_MATCH' }
  | { type: 'PREV_MATCH' }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; message: string }
  | { type: 'NEW_DRAFT' }
  | { type: 'DISMISS_DRAFT' }
  | { type: 'RESET' }

function makeInitialState(): AppState {
  return {
    mode: 'empty',
    loading: false,
    viewMode: getStoredViewMode(),
    headings: [],
    showToc: getStoredShowToc(),
    showSearch: false,
    searchQuery: '',
    searchMatchCount: 0,
    currentMatchIndex: 0
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'OPEN_START':
      return { ...state, loading: true, error: undefined }
    case 'OPEN_RESULT':
      return {
        ...state,
        loading: false,
        mode: action.payload.kind,
        rootPath: action.payload.rootPath,
        tree: action.payload.tree,
        currentFilePath: undefined,
        currentContent: undefined,
        savedContent: undefined,
        headings: [],
        showSearch: false,
        searchQuery: '',
        searchMatchCount: 0,
        currentMatchIndex: 0
      }
    case 'OPEN_ERROR':
      return { ...state, loading: false, error: action.message }
    case 'SELECT_FILE_START':
      return {
        ...state,
        loading: true,
        error: undefined,
        headings: [],
        showSearch: false,
        searchQuery: '',
        searchMatchCount: 0,
        currentMatchIndex: 0
      }
    case 'SELECT_FILE_SUCCESS':
      return {
        ...state,
        loading: false,
        currentFilePath: action.path,
        currentContent: action.content,
        savedContent: action.content
      }
    case 'SELECT_FILE_ERROR':
      return { ...state, loading: false, error: action.message }
    case 'SET_CONTENT':
      return { ...state, currentContent: action.content }
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode }
    case 'SET_HEADINGS':
      return { ...state, headings: action.headings }
    case 'SET_SHOW_TOC':
      return { ...state, showToc: action.show }
    case 'SET_ACTIVE_HEADING':
      return { ...state, activeHeadingId: action.id }
    case 'SET_SHOW_SEARCH':
      return action.show
        ? { ...state, showSearch: true }
        : { ...state, showSearch: false, searchQuery: '', searchMatchCount: 0, currentMatchIndex: 0 }
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query, currentMatchIndex: 0 }
    case 'SET_SEARCH_MATCH_COUNT':
      return {
        ...state,
        searchMatchCount: action.count,
        currentMatchIndex: action.count === 0 ? 0 : Math.min(state.currentMatchIndex, action.count - 1)
      }
    case 'NEXT_MATCH':
      return {
        ...state,
        currentMatchIndex:
          state.searchMatchCount === 0 ? 0 : (state.currentMatchIndex + 1) % state.searchMatchCount
      }
    case 'PREV_MATCH':
      return {
        ...state,
        currentMatchIndex:
          state.searchMatchCount === 0
            ? 0
            : (state.currentMatchIndex - 1 + state.searchMatchCount) % state.searchMatchCount
      }
    case 'SAVE_START':
      return { ...state, error: undefined }
    case 'SAVE_SUCCESS':
      return { ...state, savedContent: state.currentContent }
    case 'SAVE_ERROR':
      return { ...state, error: action.message }
    case 'NEW_DRAFT':
      return {
        ...state,
        mode: state.mode === 'folder' ? 'folder' : 'file',
        currentFilePath: undefined,
        // Untouched draft starts clean (savedContent matches) — only becomes
        // dirty, and prompts on discard, once the user actually types.
        currentContent: '',
        savedContent: '',
        headings: [],
        error: undefined,
        showSearch: false,
        searchQuery: '',
        searchMatchCount: 0,
        currentMatchIndex: 0
      }
    case 'DISMISS_DRAFT':
      return state.mode === 'folder'
        ? {
            ...state,
            currentFilePath: undefined,
            currentContent: undefined,
            savedContent: undefined,
            headings: [],
            showSearch: false,
            searchQuery: '',
            searchMatchCount: 0,
            currentMatchIndex: 0
          }
        : makeInitialState()
    case 'RESET':
      return makeInitialState()
    default:
      return state
  }
}

interface AppContextValue extends AppState {
  isDirty: boolean
  openPath: (targetPath: string) => Promise<void>
  openResult: (result: OpenPathResult) => Promise<void>
  createNewFile: () => void
  dismissDraft: () => void
  selectFile: (filePath: string) => Promise<void>
  setContent: (content: string) => void
  setViewMode: (mode: ViewMode) => void
  setHeadings: (headings: HeadingInfo[]) => void
  setShowToc: (show: boolean) => void
  setActiveHeadingId: (id: string | undefined) => void
  setShowSearch: (show: boolean) => void
  setSearchQuery: (query: string) => void
  setSearchMatchCount: (count: number) => void
  goToNextMatch: () => void
  goToPreviousMatch: () => void
  saveCurrentFile: () => Promise<boolean>
  reset: () => void
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  function confirmDiscardIfDirty(): boolean {
    const s = stateRef.current
    const dirty = s.currentContent !== undefined && s.currentContent !== s.savedContent
    if (!dirty) return true
    return window.confirm('You have unsaved changes. Discard them and continue?')
  }

  const loadFile = useCallback(async (filePath: string) => {
    dispatch({ type: 'SELECT_FILE_START' })
    try {
      const content = await window.api.readFile(filePath)
      dispatch({ type: 'SELECT_FILE_SUCCESS', path: filePath, content })
    } catch (err) {
      dispatch({ type: 'SELECT_FILE_ERROR', message: (err as Error).message })
    }
  }, [])

  const selectFile = useCallback(
    async (filePath: string) => {
      if (!confirmDiscardIfDirty()) return
      await loadFile(filePath)
    },
    [loadFile]
  )

  // Unchecked core of openResult — no discard-confirmation. Used internally
  // when the "unsaved changes" have just been written to disk ourselves (e.g.
  // finishing a Save As), where re-confirming would be a spurious prompt.
  const applyOpenResult = useCallback(
    async (result: OpenPathResult) => {
      dispatch({ type: 'OPEN_RESULT', payload: result })
      if (result.defaultFilePath) {
        await loadFile(result.defaultFilePath)
      }
    },
    [loadFile]
  )

  const openResult = useCallback(
    async (result: OpenPathResult) => {
      if (!confirmDiscardIfDirty()) return
      await applyOpenResult(result)
    },
    [applyOpenResult]
  )

  // Folder-aware: if the given path lives inside the currently open folder,
  // rescans and selects it there; otherwise switches to standalone file mode.
  const applyOpenedFilePath = useCallback(
    async (newPath: string) => {
      const s = stateRef.current
      const normalize = (p: string): string => p.replace(/\\/g, '/').toLowerCase()
      const inCurrentFolder =
        s.mode === 'folder' && !!s.rootPath && normalize(newPath).startsWith(`${normalize(s.rootPath)}/`)

      if (inCurrentFolder && s.rootPath) {
        const tree = await window.api.scanFolder(s.rootPath)
        await applyOpenResult({ kind: 'folder', rootPath: s.rootPath, tree, defaultFilePath: newPath })
      } else {
        await applyOpenResult({ kind: 'file', rootPath: newPath, defaultFilePath: newPath })
      }
    },
    [applyOpenResult]
  )

  const openPath = useCallback(
    async (targetPath: string) => {
      if (!confirmDiscardIfDirty()) return
      dispatch({ type: 'OPEN_START' })
      try {
        const result = await window.api.resolveOpenPath(targetPath)
        if (!result) {
          dispatch({ type: 'OPEN_ERROR', message: 'Not a markdown file or folder of markdown files.' })
          return
        }
        await openResult(result)
      } catch (err) {
        dispatch({ type: 'OPEN_ERROR', message: (err as Error).message })
      }
    },
    [openResult]
  )

  // Opens an in-memory draft immediately — no dialog, nothing touches disk
  // until the user actually saves it (or discards it via dismissDraft).
  const createNewFile = useCallback(() => {
    if (!confirmDiscardIfDirty()) return
    dispatch({ type: 'NEW_DRAFT' })
  }, [])

  const dismissDraft = useCallback(() => {
    if (!confirmDiscardIfDirty()) return
    dispatch({ type: 'DISMISS_DRAFT' })
  }, [])

  const setContent = useCallback((content: string) => dispatch({ type: 'SET_CONTENT', content }), [])

  const setViewMode = useCallback((mode: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', mode })
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
    window.api.reportViewMode(mode)
  }, [])

  const setHeadings = useCallback((headings: HeadingInfo[]) => dispatch({ type: 'SET_HEADINGS', headings }), [])

  const setShowToc = useCallback((show: boolean) => {
    dispatch({ type: 'SET_SHOW_TOC', show })
    localStorage.setItem(SHOW_TOC_STORAGE_KEY, String(show))
  }, [])

  const setActiveHeadingId = useCallback(
    (id: string | undefined) => dispatch({ type: 'SET_ACTIVE_HEADING', id }),
    []
  )

  const setShowSearch = useCallback((show: boolean) => dispatch({ type: 'SET_SHOW_SEARCH', show }), [])

  const setSearchQuery = useCallback((query: string) => dispatch({ type: 'SET_SEARCH_QUERY', query }), [])

  const setSearchMatchCount = useCallback(
    (count: number) => dispatch({ type: 'SET_SEARCH_MATCH_COUNT', count }),
    []
  )

  const goToNextMatch = useCallback(() => dispatch({ type: 'NEXT_MATCH' }), [])

  const goToPreviousMatch = useCallback(() => dispatch({ type: 'PREV_MATCH' }), [])

  // Saves the current buffer. A draft with no path yet prompts for one first
  // (Save As); returns false if there was nothing to write it to (dialog
  // canceled) or the write itself failed, true otherwise.
  const saveCurrentFile = useCallback(async (): Promise<boolean> => {
    const s = stateRef.current
    if (s.currentContent === undefined) return true
    if (s.currentFilePath && s.currentContent === s.savedContent) return true

    let targetPath = s.currentFilePath
    if (!targetPath) {
      const defaultDir = s.mode === 'folder' ? s.rootPath : undefined
      const chosen = await window.api.saveFileDialog(defaultDir)
      if (!chosen) return false
      targetPath = chosen
    }

    dispatch({ type: 'SAVE_START' })
    try {
      await window.api.writeFile(targetPath, s.currentContent)
    } catch (err) {
      dispatch({ type: 'SAVE_ERROR', message: (err as Error).message })
      return false
    }

    if (targetPath === s.currentFilePath) {
      dispatch({ type: 'SAVE_SUCCESS' })
    } else {
      await applyOpenedFilePath(targetPath)
    }
    return true
  }, [applyOpenedFilePath])

  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  const isDirty = state.currentContent !== undefined && state.currentContent !== state.savedContent

  // Keep the main process informed of the open document so it can enable/disable
  // "Export as PDF…"/"Save" and suggest a sensible default filename for PDF export.
  useEffect(() => {
    window.api.reportCurrentFile(state.currentFilePath ?? null)
  }, [state.currentFilePath])

  useEffect(() => {
    window.api.reportDirty(isDirty)
  }, [isDirty])

  // Sync the initial view mode to the menu's radio checkmarks once on startup.
  useEffect(() => {
    window.api.reportViewMode(state.viewMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return window.api.onViewModeSet((mode) => {
      dispatch({ type: 'SET_VIEW_MODE', mode })
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
    })
  }, [])

  useEffect(() => {
    return window.api.onSaveRequested(() => {
      void saveCurrentFile()
    })
  }, [saveCurrentFile])

  // The main process intercepts the window close itself (asking Save/Don't
  // Save/Cancel) when it knows there are unsaved changes; this just carries
  // out "Save" if the user picks it, and reports back whether it succeeded.
  useEffect(() => {
    return window.api.onSaveBeforeCloseRequested(() => {
      void (async () => {
        const success = await saveCurrentFile()
        window.api.reportSaveBeforeCloseResult(success)
      })()
    })
  }, [saveCurrentFile])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        dispatch({ type: 'SET_SHOW_SEARCH', show: true })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      isDirty,
      openPath,
      openResult,
      createNewFile,
      dismissDraft,
      selectFile,
      setContent,
      setViewMode,
      setHeadings,
      setShowToc,
      setActiveHeadingId,
      setShowSearch,
      setSearchQuery,
      setSearchMatchCount,
      goToNextMatch,
      goToPreviousMatch,
      saveCurrentFile,
      reset
    }),
    [
      state,
      isDirty,
      openPath,
      openResult,
      createNewFile,
      dismissDraft,
      selectFile,
      setContent,
      setViewMode,
      setHeadings,
      setShowToc,
      setActiveHeadingId,
      setShowSearch,
      setSearchQuery,
      setSearchMatchCount,
      goToNextMatch,
      goToPreviousMatch,
      saveCurrentFile,
      reset
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppState must be used within AppProvider')
  return ctx
}
