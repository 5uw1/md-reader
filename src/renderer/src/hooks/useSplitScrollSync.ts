import { useEffect, useRef } from 'react'

/** Mirrors scroll position (by percentage, since the two panes have different content
 * heights) between the editor and preview panes while split view is active.
 * Takes the actual elements (not RefObjects) so it correctly re-attaches if either
 * node is ever replaced — a plain ref's `.current` changing wouldn't otherwise
 * re-trigger this effect, since the ref object's identity stays the same. */
export function useSplitScrollSync(
  preview: HTMLElement | null,
  editor: HTMLElement | null,
  enabled: boolean
): void {
  const isSyncingRef = useRef(false)

  useEffect(() => {
    if (!enabled || !preview || !editor) return

    function syncScroll(from: HTMLElement, to: HTMLElement): void {
      if (isSyncingRef.current) return
      const fromScrollable = from.scrollHeight - from.clientHeight
      if (fromScrollable <= 0) return
      const ratio = from.scrollTop / fromScrollable
      const toScrollable = to.scrollHeight - to.clientHeight
      isSyncingRef.current = true
      to.scrollTop = ratio * toScrollable
      requestAnimationFrame(() => {
        isSyncingRef.current = false
      })
    }

    const onPreviewScroll = (): void => syncScroll(preview, editor)
    const onEditorScroll = (): void => syncScroll(editor, preview)

    preview.addEventListener('scroll', onPreviewScroll)
    editor.addEventListener('scroll', onEditorScroll)
    return () => {
      preview.removeEventListener('scroll', onPreviewScroll)
      editor.removeEventListener('scroll', onEditorScroll)
    }
  }, [enabled, preview, editor])
}
