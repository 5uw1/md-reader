import React, { forwardRef, useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
  placeholder
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { useAppState } from '../../state/AppContext'

// Reuses the same --hljs-* palette as rendered code blocks, so the raw markdown
// source and the highlighted preview agree on color regardless of light/dark theme.
const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--hljs-entity)', fontWeight: 'bold' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--accent)' },
  { tag: tags.url, color: 'var(--hljs-string)' },
  { tag: tags.monospace, color: 'var(--hljs-string)' },
  { tag: tags.quote, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--hljs-keyword)' },
  { tag: tags.contentSeparator, color: 'var(--hljs-comment)' },
  { tag: tags.processingInstruction, color: 'var(--hljs-comment)' },
  { tag: tags.meta, color: 'var(--hljs-comment)' },
  { tag: tags.keyword, color: 'var(--hljs-keyword)' },
  { tag: tags.comment, color: 'var(--hljs-comment)' },
  { tag: tags.string, color: 'var(--hljs-string)' },
  { tag: tags.number, color: 'var(--hljs-constant)' },
  { tag: tags.propertyName, color: 'var(--hljs-tag)' },
  { tag: tags.typeName, color: 'var(--hljs-keyword)' },
  { tag: tags.variableName, color: 'var(--hljs-constant)' }
])

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)'
  },
  '.cm-content': {
    fontFamily: "'Cascadia Code', Consolas, 'SF Mono', monospace",
    padding: '24px 32px',
    caretColor: 'var(--text)'
  },
  '.cm-line': {
    lineHeight: '1.6'
  },
  '.cm-scroller': {
    overflow: 'auto'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--bg-active) !important'
  },
  '.cm-placeholder': {
    color: 'var(--text-muted)'
  }
})

const EditorPane = forwardRef<HTMLElement>(function EditorPane(_props, forwardedRef) {
  const { currentContent, setContent } = useAppState()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const lastKnownContent = useRef(currentContent)

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: currentContent ?? '',
      extensions: [
        history(),
        drawSelection(),
        dropCursor(),
        highlightSpecialChars(),
        EditorView.lineWrapping,
        placeholder('Start typing markdown…'),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(markdownHighlightStyle),
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const text = update.state.doc.toString()
            lastKnownContent.current = text
            setContent(text)
          }
        })
      ]
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view
    lastKnownContent.current = currentContent

    if (typeof forwardedRef === 'function') forwardedRef(view.scrollDOM)
    else if (forwardedRef) forwardedRef.current = view.scrollDOM

    return () => {
      view.destroy()
      viewRef.current = null
      if (typeof forwardedRef === 'function') forwardedRef(null)
      else if (forwardedRef) forwardedRef.current = null
    }
    // Mounted once; external content changes are synced via the effect below instead
    // of recreating the view (which would reset cursor/undo history/scroll position).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push external content changes (switching files, discarding edits) into the editor.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const incoming = currentContent ?? ''
    if (incoming === lastKnownContent.current) return
    lastKnownContent.current = incoming
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: incoming } })
  }, [currentContent])

  return <div className="editor-pane" ref={containerRef} />
})

export default EditorPane
