import React, { useEffect, useRef } from 'react'
import { useAppState } from '../state/AppContext'
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from './icons'

export default function SearchBar(): React.JSX.Element {
  const { searchQuery, setSearchQuery, searchMatchCount, currentMatchIndex, goToNextMatch, goToPreviousMatch, setShowSearch } =
    useAppState()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      setShowSearch(false)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) goToPreviousMatch()
      else goToNextMatch()
    }
  }

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        className="search-bar__input"
        type="text"
        placeholder="Find in document… (* and ? wildcards supported)"
        title="Supports wildcards: * matches any run of characters, ? matches a single character"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span className="search-bar__count">
        {searchQuery ? (searchMatchCount > 0 ? `${currentMatchIndex + 1} of ${searchMatchCount}` : 'No results') : ''}
      </span>
      <div className="search-bar__actions">
        <button
          className="search-bar__nav-btn"
          disabled={searchMatchCount === 0}
          title="Previous match (Shift+Enter)"
          onClick={goToPreviousMatch}
        >
          <ChevronUpIcon />
        </button>
        <button
          className="search-bar__nav-btn"
          disabled={searchMatchCount === 0}
          title="Next match (Enter)"
          onClick={goToNextMatch}
        >
          <ChevronDownIcon />
        </button>
        <button className="search-bar__close-btn" title="Close (Esc)" onClick={() => setShowSearch(false)}>
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
