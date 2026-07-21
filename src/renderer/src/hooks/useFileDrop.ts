import { useEffect, useState } from 'react'
import { useAppState } from '../state/AppContext'

// Dragging a text selection within the page also fires drag events on window;
// only react when the OS is actually dragging file(s) in.
function isFileDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

export function useFileDrop(): { isDraggingOver: boolean } {
  const { openPath } = useAppState()
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  useEffect(() => {
    let dragCounter = 0

    function onDragOver(e: DragEvent): void {
      if (!isFileDrag(e)) return
      e.preventDefault()
    }

    function onDragEnter(e: DragEvent): void {
      if (!isFileDrag(e)) return
      e.preventDefault()
      dragCounter += 1
      setIsDraggingOver(true)
    }

    function onDragLeave(e: DragEvent): void {
      if (!isFileDrag(e)) return
      e.preventDefault()
      dragCounter -= 1
      if (dragCounter <= 0) {
        dragCounter = 0
        setIsDraggingOver(false)
      }
    }

    function onDrop(e: DragEvent): void {
      if (!isFileDrag(e)) return
      e.preventDefault()
      dragCounter = 0
      setIsDraggingOver(false)

      const file = e.dataTransfer?.files?.[0]
      if (!file) return
      const path = window.api.getPathForFile(file)
      if (path) void openPath(path)
    }

    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)

    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [openPath])

  return { isDraggingOver }
}
