/** Converts a glob-style query (`*` = any run of characters, `?` = exactly one
 * character) into a case-insensitive RegExp. Everything else is escaped so
 * literal regex metacharacters in the query (e.g. searching for "C++") are
 * matched as plain text. */
function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const withWildcards = escaped.replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(withWildcards, 'gi')
}

/** Finds every occurrence of `query` (supporting `*`/`?` wildcards) within the
 * text nodes under `root`, as DOM Ranges — used with the CSS Custom Highlight
 * API so matches can be highlighted without mutating the DOM (which would
 * conflict with React's reconciliation of the same subtree). */
export function findTextRanges(root: HTMLElement, query: string): Range[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const pattern = wildcardToRegExp(trimmed)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const ranges: Range[] = []

  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text))) {
      if (match[0].length === 0) {
        pattern.lastIndex += 1
        continue
      }
      const range = new Range()
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      ranges.push(range)
    }
  }
  return ranges
}
