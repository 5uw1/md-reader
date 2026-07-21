import React, { useEffect, useState } from 'react'
import { AppProvider, useAppState } from './state/AppContext'
import { ThemeProvider } from './state/ThemeContext'
import { useFileDrop } from './hooks/useFileDrop'
import { useSplitScrollSync } from './hooks/useSplitScrollSync'
import DropZone from './components/DropZone'
import FileTree from './components/Sidebar/FileTree'
import Toolbar from './components/Toolbar'
import TocPanel from './components/TocPanel'
import MarkdownViewer from './components/Viewer/MarkdownViewer'
import EditorPane from './components/Viewer/EditorPane'

function Shell(): React.JSX.Element {
  const { mode, openResult, viewMode, showToc } = useAppState()
  const { isDraggingOver } = useFileDrop()
  // State (not plain refs) so the scroll-sync effect re-attaches if either
  // node is ever replaced, e.g. EditorPane remounting.
  const [previewEl, setPreviewEl] = useState<HTMLDivElement | null>(null)
  const [editorEl, setEditorEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    return window.api.onMenuOpen((result) => {
      void openResult(result)
    })
  }, [openResult])

  useSplitScrollSync(previewEl, editorEl, viewMode === 'split')

  return (
    <div className="app">
      {mode === 'empty' ? (
        <DropZone />
      ) : (
        <div className="app__layout">
          {mode === 'folder' && (
            <aside className="app__sidebar">
              <FileTree />
            </aside>
          )}
          <main className="app__main">
            <Toolbar />
            {/* Both panes stay mounted regardless of viewMode — CSS toggles visibility.
                This keeps Export as PDF working even while in edit-only mode, since
                print styles always force the preview pane visible. */}
            <div className={`app__content app__content--${viewMode}`}>
              <div className="pane pane--preview" ref={setPreviewEl}>
                <MarkdownViewer />
              </div>
              <div className="pane pane--editor">
                <EditorPane ref={setEditorEl} />
              </div>
            </div>
          </main>
          {showToc && <TocPanel />}
        </div>
      )}
      {isDraggingOver && (
        <div className="drag-overlay">
          <div className="drag-overlay__label">Drop to open</div>
        </div>
      )}
    </div>
  )
}

export default function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ThemeProvider>
  )
}
