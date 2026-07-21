import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

let initialized = false

function ensureInitialized(isDark: boolean): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'strict'
  })
  initialized = true
}

let counter = 0

export default function MermaidBlock({ source }: { source: string }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const idRef = useRef(`mermaid-${++counter}`)

  useEffect(() => {
    let cancelled = false
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (!initialized) ensureInitialized(isDark)

    async function render(): Promise<void> {
      try {
        const { svg: renderedSvg } = await mermaid.render(idRef.current, source)
        if (!cancelled) {
          setSvg(renderedSvg)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message)
          setSvg(null)
        }
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [source])

  if (error) {
    return (
      <div className="diagram-block diagram-block--error">
        <p>Mermaid diagram error: {error}</p>
        <pre>{source}</pre>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="diagram-block diagram-block--mermaid"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg ?? '' }}
    />
  )
}
