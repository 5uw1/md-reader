import React from 'react'
import { useAppState } from '../state/AppContext'

export default function TocPanel(): React.JSX.Element | null {
  const { headings, activeHeadingId } = useAppState()

  if (headings.length === 0) return null

  const minLevel = Math.min(...headings.map((h) => h.level))

  function handleClick(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside className="app__toc">
      <div className="toc__label">On this page</div>
      <nav aria-label="Table of contents">
        {headings.map((h) => (
          <button
            key={h.id}
            className={`toc__item${h.id === activeHeadingId ? ' toc__item--active' : ''}`}
            aria-current={h.id === activeHeadingId ? 'location' : undefined}
            style={{ paddingLeft: 12 + (h.level - minLevel) * 14 }}
            onClick={() => handleClick(h.id)}
            title={h.text}
          >
            {h.text}
          </button>
        ))}
      </nav>
    </aside>
  )
}
