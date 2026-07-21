import React from 'react'
import { useAppState } from '../state/AppContext'

export default function DropZone(): React.JSX.Element {
  const { openResult, error } = useAppState()

  async function handleOpenFile(): Promise<void> {
    const result = await window.api.openFileDialog()
    if (result) await openResult(result)
  }

  async function handleOpenFolder(): Promise<void> {
    const result = await window.api.openFolderDialog()
    if (result) await openResult(result)
  }

  return (
    <div className="drop-zone">
      <div className="drop-zone__card">
        <h1 className="drop-zone__title">MD Reader</h1>
        <p className="drop-zone__subtitle">Drag &amp; drop a Markdown file or folder anywhere in this window</p>
        <div className="drop-zone__actions">
          <button className="btn btn--primary" onClick={handleOpenFile}>
            Open File…
          </button>
          <button className="btn" onClick={handleOpenFolder}>
            Open Folder…
          </button>
        </div>
        {error && <p className="drop-zone__error">{error}</p>}
      </div>
    </div>
  )
}
