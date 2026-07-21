import { useCallback, useEffect, useRef, useState } from 'react'

interface UseResizableWidthOptions {
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  /** Which edge of the pane the handle sits on and drags from.
   *  'right' = handle is on the pane's right edge (pane is on the left, e.g. sidebar).
   *  'left'  = handle is on the pane's left edge (pane is on the right, e.g. TOC). */
  handleEdge: 'left' | 'right'
}

function getStoredWidth(storageKey: string, defaultWidth: number, minWidth: number, maxWidth: number): number {
  const stored = Number(localStorage.getItem(storageKey))
  if (!Number.isFinite(stored) || stored <= 0) return defaultWidth
  return Math.min(maxWidth, Math.max(minWidth, stored))
}

export function useResizableWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  handleEdge
}: UseResizableWidthOptions): { width: number; onPointerDown: (e: React.PointerEvent) => void } {
  const [width, setWidthState] = useState(() => getStoredWidth(storageKey, defaultWidth, minWidth, maxWidth))
  const widthRef = useRef(width)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const setWidth = useCallback((w: number) => {
    widthRef.current = w
    setWidthState(w)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = widthRef.current
    document.body.classList.add('resizing-col')
    e.preventDefault()
  }, [])

  useEffect(() => {
    function onPointerMove(e: PointerEvent): void {
      if (!draggingRef.current) return
      const delta = e.clientX - startXRef.current
      const signedDelta = handleEdge === 'right' ? delta : -delta
      setWidth(Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + signedDelta)))
    }
    function onPointerUp(): void {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.classList.remove('resizing-col')
      localStorage.setItem(storageKey, String(widthRef.current))
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [handleEdge, maxWidth, minWidth, setWidth, storageKey])

  return { width, onPointerDown }
}
