import React, { useState } from 'react'
import type { FileTreeNode } from '../../../../shared/types'
import { useAppState } from '../../state/AppContext'

function TreeNode({ node, depth }: { node: FileTreeNode; depth: number }): React.JSX.Element {
  const { currentFilePath, selectFile } = useAppState()
  const [collapsed, setCollapsed] = useState(false)

  if (node.type === 'file') {
    const isActive = node.path === currentFilePath
    return (
      <div
        className={`file-tree__item file-tree__item--file${isActive ? ' file-tree__item--active' : ''}`}
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => void selectFile(node.path)}
        title={node.path}
      >
        <span className="file-tree__icon">📄</span>
        <span className="file-tree__label">{node.name}</span>
      </div>
    )
  }

  return (
    <div className="file-tree__group">
      <div
        className="file-tree__item file-tree__item--dir"
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="file-tree__icon">{collapsed ? '▸' : '▾'}</span>
        <span className="file-tree__label">{node.name}</span>
      </div>
      {!collapsed &&
        node.children?.map((child) => <TreeNode key={child.path} node={child} depth={depth + 1} />)}
    </div>
  )
}

export default function FileTree(): React.JSX.Element | null {
  const { tree } = useAppState()
  if (!tree) return null

  return (
    <nav className="file-tree" aria-label="Markdown files">
      <div className="file-tree__root-label">{tree.name}</div>
      {tree.children?.map((child) => <TreeNode key={child.path} node={child} depth={0} />)}
    </nav>
  )
}
