import React from 'react'

function formatSize(bytes) {
  if (bytes < 1024)        return bytes + ' B'
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function PreviewPane({ file }) {
  function handleOpen() {
    window.panAPI.openFile(file.path)
  }

  function handleShowInFolder() {
    window.panAPI.showInFolder(file.path)
  }

  return (
    <div className="preview-pane">
      <div className="preview-info">
        <div className="preview-name">{file.name}</div>
        <div className="preview-detail">
          {file.ext.toUpperCase()} · {formatSize(file.size)}
        </div>
      </div>
      <div className="preview-actions">
        <button onClick={handleOpen}>Open</button>
        <button onClick={handleShowInFolder}>Show in folder</button>
      </div>
    </div>
  )
}

export default PreviewPane