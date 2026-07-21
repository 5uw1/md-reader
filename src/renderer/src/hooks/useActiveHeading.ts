import { useEffect, useRef } from 'react'
import type { HeadingInfo } from '../../../shared/types'

const TOP_OFFSET = 16

/** Scrollspy: reports whichever heading is at/just past the top of the preview
 * viewport, so the TOC can highlight the section currently being read. */
export function useActiveHeading(
  previewEl: HTMLElement | null,
  headings: HeadingInfo[],
  enabled: boolean,
  onActiveChange: (id: string | undefined) => void
): void {
  const tickingRef = useRef(false)

  useEffect(() => {
    if (!previewEl || headings.length === 0) {
      onActiveChange(undefined)
      return
    }
    // Leave the last-known active heading as-is while the preview is hidden
    // (e.g. Edit-only view), rather than clearing or guessing at a hidden layout.
    if (!enabled) return

    function computeActive(): void {
      // Skip while the preview pane is hidden (e.g. Edit-only view) — it's
      // zero-sized then, and every heading would falsely measure as "at the top".
      if (previewEl!.clientHeight === 0) return

      const containerTop = previewEl!.getBoundingClientRect().top
      let activeId: string = headings[0].id
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (!el) continue
        const relativeTop = el.getBoundingClientRect().top - containerTop
        if (relativeTop <= TOP_OFFSET) {
          activeId = h.id
        } else {
          break
        }
      }
      onActiveChange(activeId)
    }

    function onScroll(): void {
      if (tickingRef.current) return
      tickingRef.current = true
      requestAnimationFrame(() => {
        computeActive()
        tickingRef.current = false
      })
    }

    computeActive()
    previewEl.addEventListener('scroll', onScroll)
    return () => previewEl.removeEventListener('scroll', onScroll)
  }, [previewEl, headings, onActiveChange])
}
