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
  createNewFile: () => Promise<void>
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
  saveCurrentFile: () => Promise<void>
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

  const openResult = useCallback(
    async (result: OpenPathResult) => {
      if (!confirmDiscardIfDirty()) return
      dispatch({ type: 'OPEN_RESULT', payload: result })
      if (result.defaultFilePath) {
        await loadFile(result.defaultFilePath)
      }
    },
    [loadFile]
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

  const createNewFile = useCallback(async () => {
    const s = stateRef.current
    const defaultDir = s.mode === 'folder' ? s.rootPath : undefined
    const newPath = await window.api.newFileDialog(defaultDir)
    if (!newPath) return

    const normalize = (p: string): string => p.replace(/\\/g, '/').toLowerCase()
    const inCurrentFolder =
      s.mode === 'folder' && !!s.rootPath && normalize(newPath).startsWith(`${normalize(s.rootPath)}/`)

    if (inCurrentFolder && s.rootPath) {
      const tree = await window.api.scanFolder(s.rootPath)
      await openResult({ kind: 'folder', rootPath: s.rootPath, tree, defaultFilePath: newPath })
    } else {
      await openResult({ kind: 'file', rootPath: newPath, defaultFilePath: newPath })
    }
  }, [openResult])

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

  const saveCurrentFile = useCallback(async () => {
    const s = stateRef.current
    if (!s.currentFilePath || s.currentContent === undefined) return
    if (s.currentContent === s.savedContent) return
    dispatch({ type: 'SAVE_START' })
    try {
      await window.api.writeFile(s.currentFilePath, s.currentContent)
      dispatch({ type: 'SAVE_SUCCESS' })
    } catch (err) {
      dispatch({ type: 'SAVE_ERROR', message: (err as Error).message })
    }
  }, [])

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

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent): void {
      const s = stateRef.current
      const dirty = s.currentContent !== undefined && s.currentContent !== s.savedContent
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

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
