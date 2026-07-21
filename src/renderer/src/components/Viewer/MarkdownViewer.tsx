import React, { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import { useAppState } from '../../state/AppContext'
import { isMarkdownPath, resolveRelativePath, toFileUrl } from '../../lib/pathUtils'
import type { HeadingInfo } from '../../../../shared/types'
import MermaidBlock from './MermaidBlock'
import PlantUmlBlock from './PlantUmlBlock'
import 'katex/dist/katex.min.css'

interface CodeElement {
  props: { className?: string; children?: React.ReactNode }
}

export default function MarkdownViewer(): React.JSX.Element {
  const { currentFilePath, currentContent, selectFile, setHeadings } = useAppState()
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

  if (!currentFilePath || currentContent === undefined) {
    return <div className="markdown-viewer markdown-viewer--empty" ref={containerRef}>Select a file to read.</div>
  }

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

  return (
    <div className="markdown-viewer" ref={containerRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSlug, rehypeKatex, rehypeHighlight]}
        components={{
          pre({ children }) {
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
          img({ src, alt }) {
            if (!src || !currentFilePath) return <img alt={alt} />
            const resolved = resolveRelativePath(currentFilePath, src)
            const finalSrc = resolved.startsWith('http') || resolved.startsWith('data:') ? resolved : toFileUrl(resolved)
            return <img src={finalSrc} alt={alt} />
          },
          a({ href, children }) {
            return (
              <a href={href} onClick={(e) => handleLinkClick(e, href)}>
                {children}
              </a>
            )
          }
        }}
      >
        {currentContent}
      </ReactMarkdown>
    </div>
  )
}
