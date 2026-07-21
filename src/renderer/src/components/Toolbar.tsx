import React from 'react'
import { useAppState } from '../state/AppContext'
import { baseName } from '../lib/pathUtils'
import type { ViewMode } from '../../../shared/types'

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'preview', label: 'Preview' },
  { value: 'edit', label: 'Edit' },
  { value: 'split', label: 'Split' }
]

export default function Toolbar(): React.JSX.Element {
  const {
    currentFilePath,
    viewMode,
    setViewMode,
    headings,
    showToc,
    setShowToc,
    isDirty,
    saveCurrentFile,
    loading,
    error
  } = useAppState()

  return (
    <div className="toolbar">
      <span className="toolbar__filename" title={currentFilePath}>
        {currentFilePath ? baseName(currentFilePath) : ''}
        {isDirty && <span className="toolbar__dirty-dot" title="Unsaved changes" />}
      </span>

      <div className="toolbar__modes" role="tablist" aria-label="View mode">
        {MODES.map((m) => (
          <button
            key={m.value}
            role="tab"
            aria-selected={viewMode === m.value}
            className={`toolbar__mode-btn${viewMode === m.value ? ' toolbar__mode-btn--active' : ''}`}
            onClick={() => setViewMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {error && <span className="toolbar__error">{error}</span>}

      {headings.length > 0 && (
        <button
          className={`toolbar__toc-btn${showToc ? ' toolbar__toc-btn--active' : ''}`}
          aria-pressed={showToc}
          title={showToc ? 'Hide table of contents' : 'Show table of contents'}
          onClick={() => setShowToc(!showToc)}
        >
          Contents
        </button>
      )}

      <button
        className="btn btn--primary toolbar__save"
        disabled={!isDirty || loading}
        onClick={() => void saveCurrentFile()}
      >
        Save
      </button>
    </div>
  )
}
