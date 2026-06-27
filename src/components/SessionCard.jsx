import React from 'react'

function SessionCard({ session }) {
  return (
    <div className="session-card">
      <div className="session-icon">◷</div>
      <div className="session-info">
        <div className="session-name">{session.name}</div>
        <div className="session-files">
          {session.files.slice(0, 3).map(f => f.name).join(', ')}
          {session.fileCount > 3 ? ` +${session.fileCount - 3} more` : ''}
        </div>
      </div>
      <div className="session-date">{session.date}</div>
    </div>
  )
}

export default SessionCard