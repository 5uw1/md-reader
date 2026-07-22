import React, { forwardRef, useEffect, useRef } from 'react'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
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
import { findStringMatches } from '../../lib/searchHighlight'

const searchMatchMark = Decoration.mark({ class: 'cm-search-match' })
const searchCurrentMark = Decoration.mark({ class: 'cm-search-current' })

const setSearchMatches = StateEffect.define<{ matches: { from: number; to: number }[]; currentIndex: number }>()

const searchMatchField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const effect of tr.effects) {
      if (effect.is(setSearchMatches)) {
        const { matches, currentIndex } = effect.value
        const marks = matches
          .filter((m) => m.to <= tr.state.doc.length)
          .map((m, i) => (i === currentIndex ? searchCurrentMark : searchMatchMark).range(m.from, m.to))
        deco = Decoration.set(marks, true)
      }
    }
    return deco
  },
  provide: (field) => EditorView.decorations.from(field)
})

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
  '.cm-cursor': {
    borderLeftColor: 'var(--text)'
  },
  '.cm-placeholder': {
    color: 'var(--text-muted)'
  }
})

const EditorPane = forwardRef<HTMLElement>(function EditorPane(_props, forwardedRef) {
  const { currentContent, setContent, viewMode, searchQuery, currentMatchIndex, setSearchMatchCount } =
    useAppState()
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
        searchMatchField,
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

  // The preview pane is hidden in Edit-only mode, so it can't own search there —
  // the editor takes over as the source of truth for the match count/highlighting
  // whenever it's the only (or the) visible surface for reading raw text.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    if (viewMode !== 'edit') {
      view.dispatch({ effects: setSearchMatches.of({ matches: [], currentIndex: -1 }) })
      return
    }

    const matches = findStringMatches(currentContent ?? '', searchQuery)
    setSearchMatchCount(matches.length)
    const currentIndex = matches.length === 0 ? -1 : Math.min(currentMatchIndex, matches.length - 1)
    view.dispatch({ effects: setSearchMatches.of({ matches, currentIndex }) })

    if (currentIndex >= 0) {
      const target = matches[currentIndex]
      view.dispatch({ effects: EditorView.scrollIntoView(target.from, { y: 'center' }) })
    }
  }, [viewMode, searchQuery, currentContent, currentMatchIndex, setSearchMatchCount])

  return <div className="editor-pane" ref={containerRef} />
})

export default EditorPane
