/** Finds every case-insensitive occurrence of `query` within the text nodes
 * under `root`, as DOM Ranges — used with the CSS Custom Highlight API so
 * matches can be highlighted without mutating the DOM (which would conflict
 * with React's reconciliation of the same subtree). */
export function findTextRanges(root: HTMLElement, query: string): Range[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const lowerQuery = trimmed.toLowerCase()
  const ranges: Range[] = []

  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    const lowerText = text.toLowerCase()
    let idx = lowerText.indexOf(lowerQuery)
    while (idx !== -1) {
      const range = new Range()
      range.setStart(node, idx)
      range.setEnd(node, idx + trimmed.length)
      ranges.push(range)
      idx = lowerText.indexOf(lowerQuery, idx + trimmed.length)
    }
  }
  return ranges
}
