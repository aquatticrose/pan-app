import React from 'react'

// Maps extensions to a short uppercase label shown in the icon pill
const EXT_LABELS = {
  pdf: 'PDF', doc: 'DOC', docx: 'DOC',
  xls: 'XLS', xlsx: 'XLS', csv: 'CSV',
  jpg: 'JPG', jpeg: 'JPG', png: 'PNG',
  gif: 'GIF', webp: 'IMG',
  mp4: 'MP4', mov: 'MOV',
  mp3: 'MP3', wav: 'WAV',
  js: 'JS', jsx: 'JSX', ts: 'TS', tsx: 'TSX',
  py: 'PY', html: 'HTM', css: 'CSS',
  zip: 'ZIP', rar: 'RAR',
  txt: 'TXT', md: 'MD',
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatTime(ms) {
  const diff = Date.now() - ms
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function ResultRow({ file, selected, onClick }) {
  const label = EXT_LABELS[file.ext] || file.ext?.toUpperCase() || '?'

  // The icon div gets two class names:
  // 'file-icon' for the base styles (size, shape, flex centering)
  // and file.ext for the colour (e.g. 'pdf' → red, 'docx' → blue)
  // If no colour match exists, 'default' gives it a neutral grey
  const iconClass = `file-icon ${file.ext || 'default'}`

  return (
    <div
      className={`result-row ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className={iconClass}>{label}</div>
      <div className="result-meta">
        <div className="result-name">{file.name}</div>
        <div className="result-path">{file.path}</div>
      </div>
      <div className="result-time">{formatTime(file.modified)}</div>
    </div>
  )
}

export default ResultRow