import React from 'react'

function SearchBar({ query, onChange }) {
  return (
    <div className="search-bar">
      <span className="search-icon">⌕</span>
      <input
        type="text"
        placeholder="find a file or session…"
        value={query}
        onChange={e => onChange(e.target.value)}
        autoFocus
      />
      {query && (
        <button className="clear-btn" onClick={() => onChange('')}>✕</button>
      )}
    </div>
  )
}

export default SearchBar