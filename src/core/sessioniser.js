const { getIndex } = require('./indexer')

// How big a time gap (in milliseconds) triggers a new session
// 2 hours = 2 * 60 minutes * 60 seconds * 1000 milliseconds
const SESSION_GAP = 2 * 60 * 60 * 1000

// Minimum number of files to bother calling it a session
// A single file isn't really a "session"
const MIN_FILES = 2

// Maps file extensions to a category label
// We use this to name sessions automatically
const EXT_CATEGORIES = {
  pdf:  'study',
  doc:  'writing', docx: 'writing',
  txt:  'writing', md:   'writing',
  js:   'dev', jsx: 'dev', ts:  'dev',
  tsx:  'dev', py:  'dev', css: 'dev', html: 'dev',
  jpg:  'creative', jpeg: 'creative',
  png:  'creative', svg:  'creative',
  xlsx: 'data', xls: 'data', csv: 'data',
  mp4:  'media', mov: 'media', mp3: 'media',
}

// Maps a dominant category to a human-readable session name
const CATEGORY_NAMES = {
  study:    'Study session',
  writing:  'Writing session',
  dev:      'Dev session',
  creative: 'Creative session',
  data:     'Data session',
  media:    'Media session',
  mixed:    'Work session'
}

// Given a list of files, figure out the best name for the session
// by counting which category appears most often
function nameSession(files) {
  // Count how many files fall into each category
  const counts = {}

  for (const file of files) {
    const category = EXT_CATEGORIES[file.ext] || 'mixed'
    counts[category] = (counts[category] || 0) + 1
  }

  // Find the category with the highest count
  // Object.entries turns { study: 3, dev: 1 } into [['study', 3], ['dev', 1]]
  // then we sort by count descending and take the first one
  const dominant = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0][0]

  return CATEGORY_NAMES[dominant] || 'Work session'
}

// Format a timestamp into a readable label like "Today", "Yesterday", "Mon 16 Jun"
function formatSessionDate(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()

  // Strip time from both dates so we're comparing just the calendar day
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return date.toLocaleDateString('en-GB', { weekday: 'long' })
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// The main function — builds all sessions from the current file index
function buildSessions() {
  const index = getIndex()

  // Step 1: Sort every file by modified time, oldest first
  // We sort oldest-first so we walk through time in order
  const sorted = [...index].sort((a, b) => a.modified - b.modified)

  // Step 2: Group files into sessions
  const sessions = []
  let currentSession = []

  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i]

    if (currentSession.length === 0) {
      // No session started yet — this file begins the first one
      currentSession.push(file)
    } else {
      // Get the last file we added to the current session
      const lastFile = currentSession[currentSession.length - 1]

      // Calculate the time gap between this file and the last one
      const gap = file.modified - lastFile.modified

      if (gap <= SESSION_GAP) {
        // Gap is small — same session, keep adding
        currentSession.push(file)
      } else {
        // Gap is too large — save the current session and start a new one
        if (currentSession.length >= MIN_FILES) {
          sessions.push(currentSession)
        }
        currentSession = [file] // start fresh with this file
      }
    }
  }

  // Don't forget the last session — the loop ends without saving it
  if (currentSession.length >= MIN_FILES) {
    sessions.push(currentSession)
  }

  // Step 3: Turn each raw file group into a proper session object
  // We also reverse so the most recent session appears first
  return sessions.reverse().map((files, i) => {
    // The session's timestamp = when the most recent file in it was modified
    const latestTimestamp = Math.max(...files.map(f => f.modified))

    return {
      id: i,
      name: nameSession(files),         // e.g. "Study session"
      date: formatSessionDate(latestTimestamp), // e.g. "Yesterday"
      timestamp: latestTimestamp,
      fileCount: files.length,
      files: files                       // the actual list of files
    }
  })
}

module.exports = { buildSessions }