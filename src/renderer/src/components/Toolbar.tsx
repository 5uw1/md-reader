import React from 'react'
import { useAppState } from '../state/AppContext'
import { baseName } from '../lib/pathUtils'
import type { ViewMode } from '../../../shared/types'
import { PreviewIcon, EditIcon, SplitIcon, ContentsIcon, SaveIcon, SearchIcon } from './icons'

const MODES: { value: ViewMode; label: string; Icon: typeof PreviewIcon }[] = [
  { value: 'preview', label: 'Preview', Icon: PreviewIcon },
  { value: 'edit', label: 'Edit', Icon: EditIcon },
  { value: 'split', label: 'Split', Icon: SplitIcon }
]

export default function Toolbar(): React.JSX.Element {
  const {
    currentFilePath,
    viewMode,
    setViewMode,
    headings,
    showToc,
    setShowToc,
    showSearch,
    setShowSearch,
    isDirty,
    saveCurrentFile,
    loading,
    error
  } = useAppState()

  const canSave = viewMode !== 'preview'

  return (
    <div className="toolbar">
      <span className="toolbar__filename" title={currentFilePath}>
        {currentFilePath ? baseName(currentFilePath) : ''}
        {isDirty && <span className="toolbar__dirty-dot" title="Unsaved changes" />}
      </span>

      <div className="toolbar__spacer" />

      {/* Rendered (not conditionally unmounted) so the mode group to its right
          never shifts position when Save becomes available/unavailable. */}
      <button
        className="toolbar__icon-btn toolbar__icon-btn--primary"
        style={{ visibility: canSave ? 'visible' : 'hidden' }}
        aria-label="Save"
        title="Save (Ctrl+S)"
        disabled={!canSave || !isDirty || loading}
        onClick={() => void saveCurrentFile()}
      >
        <SaveIcon />
      </button>

      <div className="toolbar__modes" role="tablist" aria-label="View mode">
        {MODES.map(({ value, label, Icon }) => (
          <button
            key={value}
            role="tab"
            aria-selected={viewMode === value}
            aria-label={label}
            title={label}
            className={`toolbar__mode-btn${viewMode === value ? ' toolbar__mode-btn--active' : ''}`}
            onClick={() => setViewMode(value)}
          >
            <Icon />
          </button>
        ))}
      </div>

      {error && <span className="toolbar__error">{error}</span>}

      <button
        className={`toolbar__icon-btn${showSearch ? ' toolbar__icon-btn--active' : ''}`}
        aria-pressed={showSearch}
        aria-label={showSearch ? 'Close search' : 'Find in document'}
        title={showSearch ? 'Close search' : 'Find in document (Ctrl+F)'}
        onClick={() => setShowSearch(!showSearch)}
      >
        <SearchIcon />
      </button>

      {headings.length > 0 && (
        <button
          className={`toolbar__icon-btn${showToc ? ' toolbar__icon-btn--active' : ''}`}
          aria-pressed={showToc}
          aria-label={showToc ? 'Hide table of contents' : 'Show table of contents'}
          title={showToc ? 'Hide table of contents' : 'Show table of contents'}
          onClick={() => setShowToc(!showToc)}
        >
          <ContentsIcon />
        </button>
      )}
    </div>
  )
}
