import React, { useState, useEffect } from 'react'

function Settings({ onClose }) {
  // The list of currently indexed folders
  const [folders, setFolders] = useState([])

  // Whether we're currently waiting for the user to pick a folder
  const [picking, setPicking] = useState(false)

  // Load the current folder list when the Settings panel opens
  useEffect(() => {
    async function load() {
      const f = await window.panAPI.getFolders()
      setFolders(f)
    }
    load()
  }, [])

  // Open the native folder picker dialog
  // If the user picks a folder, add it to the list
  async function handleAdd() {
    setPicking(true)
    const chosen = await window.panAPI.pickFolder()
    setPicking(false)

    if (!chosen) return // user cancelled

    // Add it via IPC — main.js saves it and re-indexes
    const updated = await window.panAPI.addFolder(chosen)
    setFolders(updated)
  }

  // Remove a folder from the list
  async function handleRemove(folderPath) {
    const updated = await window.panAPI.removeFolder(folderPath)
    setFolders(updated)
  }

  // Shorten long paths for display
  // e.g. /Users/thelma/Documents → ~/Documents
  function displayPath(p) {
    const home = '/Users/' + p.split('/')[2]
    return p.replace(home, '~')
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      {/* stopPropagation prevents clicks inside the panel
          from bubbling up and closing it via the overlay click */}
      <div className="settings-panel" onClick={e => e.stopPropagation()}>

        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-section">
          <div className="settings-section-label">Indexed Folders</div>
          <div className="settings-section-hint">
            Pan searches these folders when you type. Changes take effect immediately.
          </div>

          <div className="folder-list">
            {folders.length === 0 && (
              <div className="folder-empty">No folders added yet.</div>
            )}
            {folders.map((folder, i) => (
              <div key={i} className="folder-row">
                <span className="folder-icon">📁</span>
                <span className="folder-path">{displayPath(folder)}</span>
                <button
                  className="folder-remove"
                  onClick={() => handleRemove(folder)}
                  title="Remove this folder"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            className="add-folder-btn"
            onClick={handleAdd}
            disabled={picking}
          >
            {picking ? 'Choosing…' : '+ Add Folder'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default Settings