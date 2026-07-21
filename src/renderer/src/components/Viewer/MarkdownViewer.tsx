import React, { useEffect, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import { useAppState } from '../../state/AppContext'
import { isMarkdownPath, resolveRelativePath, toFileUrl } from '../../lib/pathUtils'
import { findTextRanges } from '../../lib/searchHighlight'
import type { HeadingInfo } from '../../../../shared/types'
import MermaidBlock from './MermaidBlock'
import PlantUmlBlock from './PlantUmlBlock'
import 'katex/dist/katex.min.css'

interface CodeElement {
  props: { className?: string; children?: React.ReactNode }
}

const SEARCH_MATCH_HIGHLIGHT = 'md-search-match'
const SEARCH_CURRENT_HIGHLIGHT = 'md-search-current'

// Stable references — react-markdown treats a new array/object each render as
// "props changed", which tears down and rebuilds the whole rendered tree
// (including remounting Mermaid/PlantUML diagrams). These plugins never change,
// so they're declared once at module scope instead of recreated every render.
const REMARK_PLUGINS = [remarkGfm, remarkMath]
const REHYPE_PLUGINS = [rehypeSlug, rehypeKatex, rehypeHighlight]

export default function MarkdownViewer(): React.JSX.Element {
  const {
    currentFilePath,
    currentContent,
    selectFile,
    setHeadings,
    searchQuery,
    currentMatchIndex,
    setSearchMatchCount
  } = useAppState()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const nodes = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const headings: HeadingInfo[] = Array.from(nodes)
      .filter((el): el is HTMLElement => el.id !== '')
      .map((el) => ({ id: el.id, text: el.textContent ?? '', level: Number(el.tagName[1]) }))
    setHeadings(headings)
  }, [currentContent, setHeadings])

  // Highlight search matches via the CSS Custom Highlight API — this only affects
  // rendering, so it can't conflict with React's reconciliation of this subtree
  // the way wrapping matches in <mark> elements directly in the DOM would.
  useEffect(() => {
    const container = containerRef.current
    const highlights = (CSS as unknown as { highlights?: Map<string, Highlight> }).highlights
    if (!container || !highlights) return

    const ranges = findTextRanges(container, searchQuery)
    setSearchMatchCount(ranges.length)

    if (ranges.length === 0) {
      highlights.delete(SEARCH_MATCH_HIGHLIGHT)
      highlights.delete(SEARCH_CURRENT_HIGHLIGHT)
      return
    }

    highlights.set(SEARCH_MATCH_HIGHLIGHT, new Highlight(...ranges))
    const currentRange = ranges[Math.min(currentMatchIndex, ranges.length - 1)]
    highlights.set(SEARCH_CURRENT_HIGHLIGHT, new Highlight(currentRange))

    const rect = currentRange.getBoundingClientRect()
    const scrollParent = container.parentElement
    if (scrollParent && (rect.width > 0 || rect.height > 0)) {
      const parentRect = scrollParent.getBoundingClientRect()
      scrollParent.scrollTop += rect.top - parentRect.top - scrollParent.clientHeight / 2 + rect.height / 2
    }

    return () => {
      highlights.delete(SEARCH_MATCH_HIGHLIGHT)
      highlights.delete(SEARCH_CURRENT_HIGHLIGHT)
    }
  }, [searchQuery, currentContent, currentMatchIndex, setSearchMatchCount])

  const components = useMemo(() => {
    function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>, href: string | undefined): void {
      if (!href || !currentFilePath) return
      e.preventDefault()
      const resolved = resolveRelativePath(currentFilePath, href)
      if (resolved.startsWith('http') || resolved.startsWith('mailto:')) {
        void window.api.openExternal(resolved)
      } else if (isMarkdownPath(resolved)) {
        void selectFile(resolved)
      } else {
        void window.api.openExternal(toFileUrl(resolved))
      }
    }

    return {
      pre({ children }: { children?: React.ReactNode }) {
        const child = children as CodeElement
        const className = React.isValidElement(child) ? child.props.className : undefined
        if (className) {
          const match = /language-(\w+)/.exec(className)
          const lang = match?.[1]
          if (lang === 'mermaid' || lang === 'plantuml' || lang === 'puml') {
            const rawChildren = React.isValidElement(child) ? child.props.children : ''
            const source = String(rawChildren ?? '').replace(/\n$/, '')
            if (lang === 'mermaid') return <MermaidBlock source={source} />
            return <PlantUmlBlock source={source} />
          }
        }
        return <pre>{children}</pre>
      },
      img({ src, alt }: { src?: string; alt?: string }) {
        if (!src || !currentFilePath) return <img alt={alt} />
        const resolved = resolveRelativePath(currentFilePath, src)
        const finalSrc = resolved.startsWith('http') || resolved.startsWith('data:') ? resolved : toFileUrl(resolved)
        return <img src={finalSrc} alt={alt} />
      },
      a({ href, children }: { href?: string; children?: React.ReactNode }) {
        return (
          <a href={href} onClick={(e) => handleLinkClick(e, href)}>
            {children}
          </a>
        )
      }
    }
  }, [currentFilePath, selectFile])

  if (!currentFilePath || currentContent === undefined) {
    return (
      <div className="markdown-viewer markdown-viewer--empty" ref={containerRef}>
        Select a file to read.
      </div>
    )
  }

  return (
    <div className="markdown-viewer" ref={containerRef}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={components}>
        {currentContent}
      </ReactMarkdown>
    </div>
  )
}
