const { getIndex } = require('./indexer')

// Smarter time hints — each phrase maps to a function that returns
// a { from, to } object representing the exact time window.
// Using functions (not fixed values) means the window is calculated
// fresh every time a search runs, so "today" always means *today*,
// not "24 hours from when the app started"
function getTimeWindow(phrase) {
  const now = Date.now()
  const minute = 60 * 1000
  const hour   = 60 * minute
  const day    = 24 * hour

  // Get the start of today (midnight)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayMs = todayStart.getTime()

  // Get the start of yesterday
  const yesterdayMs = todayMs - day

  switch (phrase) {
    case 'just now':
      // Last 30 minutes
      return { from: now - 30 * minute, to: now }

    case 'today':
      // Since midnight today
      return { from: todayMs, to: now }

    case 'last night':
      // 6pm yesterday to 4am today — what people mean by "last night"
      return { from: yesterdayMs + 18 * hour, to: todayMs + 4 * hour }

    case 'yesterday':
      // The whole of yesterday, midnight to midnight
      return { from: yesterdayMs, to: todayMs }

    case 'this week':
    case 'last week':
      // Last 7 days
      return { from: now - 7 * day, to: now }

    case 'last month':
    case 'this month':
      // Last 30 days
      return { from: now - 30 * day, to: now }

    default:
      return null
  }
}

// Words that appear in queries but carry no useful search meaning
// Matching against these would give false score boosts
const STOP_WORDS = new Set([
  'from', 'the', 'a', 'an', 'last', 'night', 'week',
  'that', 'my', 'in', 'on', 'at', 'to', 'of', 'for',
  'this', 'ago', 'about', 'some', 'just', 'now',
  'today', 'yesterday', 'month', 'year'
])

// File type hints — maps natural language words to extensions
const TYPE_HINTS = {
  'pdf':        ['pdf'],
  'doc':        ['doc', 'docx'],
  'word':       ['doc', 'docx'],
  'document':   ['doc', 'docx', 'pdf', 'txt', 'md'],
  'image':      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic'],
  'photo':      ['jpg', 'jpeg', 'png', 'heic'],
  'picture':    ['jpg', 'jpeg', 'png', 'heic', 'gif'],
  'screenshot': ['png', 'jpg', 'jpeg'],
  'video':      ['mp4', 'mov', 'avi', 'mkv', 'm4v'],
  'audio':      ['mp3', 'wav', 'aac', 'm4a', 'flac'],
  'music':      ['mp3', 'wav', 'aac', 'm4a', 'flac'],
  'spreadsheet':['xlsx', 'xls', 'csv'],
  'excel':      ['xlsx', 'xls'],
  'csv':        ['csv'],
  'code':       ['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'json'],
  'script':     ['js', 'jsx', 'ts', 'tsx', 'py', 'sh'],
  'zip':        ['zip', 'rar', '7z', 'tar', 'gz'],
  'archive':    ['zip', 'rar', '7z', 'tar', 'gz'],
  'note':       ['txt', 'md', 'rtf'],
  'text':       ['txt', 'md', 'rtf'],
  'markdown':   ['md'],
  'presentation':['pptx', 'ppt', 'key'],
  'slides':     ['pptx', 'ppt', 'key'],
}

function search(query) {
  if (!query || query.trim() === '') return []

  const index = getIndex()
  const q = query.toLowerCase().trim()
  const words = q.split(/\s+/).filter(w => w.length > 1)

  // --- Detect time window ---
  // Check for multi-word time phrases first (longest match wins)
  // so "last night" matches before "last" or "night" individually
  const TIME_PHRASES = [
    'just now', 'last night', 'this week', 'last week',
    'this month', 'last month', 'today', 'yesterday'
  ]

  let timeWindow = null
  let matchedTimePhrase = null

  for (const phrase of TIME_PHRASES) {
    if (q.includes(phrase)) {
      timeWindow = getTimeWindow(phrase)
      matchedTimePhrase = phrase
      break
    }
  }

  // --- Detect file type filter ---
  let typeFilter = null
  for (const [hint, exts] of Object.entries(TYPE_HINTS)) {
    if (q.includes(hint)) {
      typeFilter = exts
      break
    }
  }

  // --- Filter meaningful search words ---
  // Remove stop words and time/type hint words from the search terms
  // so they don't falsely boost filenames that contain them
  const timeWords = matchedTimePhrase ? matchedTimePhrase.split(' ') : []
  const typeWords = typeFilter
    ? Object.keys(TYPE_HINTS).filter(h => q.includes(h))
    : []

  const searchWords = words.filter(w =>
    !STOP_WORDS.has(w) &&
    !timeWords.includes(w) &&
    !typeWords.includes(w) &&
    w.length > 1
  )

  // Score every file in the index
  const scored = index.map(file => {
    let score = 0
    const nameLower = file.name.toLowerCase()

    // --- Hard time filter ---
    // If a time phrase was given, exclude files outside that window entirely.
    // Set score to -1 and return early — no point scoring further.
    if (timeWindow) {
      if (file.modified < timeWindow.from || file.modified > timeWindow.to) {
        return { ...file, score: -1 }
      } else {
        // Inside the time window — solid reward
        score += 15
      }
    }

    // --- Hard type filter ---
    // Same principle — wrong type means excluded entirely
    if (typeFilter) {
      if (typeFilter.includes(file.ext)) {
        score += 8
      } else {
        return { ...file, score: -1 }
      }
    }

    // --- Name matching ---
    for (const word of searchWords) {
      if (nameLower.includes(word)) {
        score += 10 // word appears somewhere in the filename

        // Extra points for starting with the word
        if (nameLower.startsWith(word)) score += 4

        // Extra points for exact word boundary match
        // e.g. "note" matching "notes" vs "keynote" — prefer the former
        const wordBoundary = new RegExp(`(^|[_\\-\\s\\.])${word}`, 'i')
        if (wordBoundary.test(nameLower)) score += 3
      }
    }

    // --- Multi-word proximity bonus ---
    // If the user typed multiple search words and they all appear
    // in the filename in order, that's a much stronger match.
    // e.g. searching "design notes" and finding "design_notes.pdf"
    // is better than finding "my_notes_about_design_thinking.pdf"
    if (searchWords.length > 1) {
      const combined = searchWords.join('.*') // regex: words appear in order
      const proximityRegex = new RegExp(combined, 'i')
      if (proximityRegex.test(nameLower)) {
        score += 12 // strong bonus for in-order multi-word match
      }
    }

    // If no search words matched at all and we had search terms,
    // this file isn't relevant — exclude it
    if (searchWords.length > 0 && score === 0) {
      return { ...file, score: -1 }
    }

    // Recency bonus — even without a time phrase, slightly prefer
    // more recently modified files as tiebreakers.
    // We divide by a large number so recent files get a small nudge,
    // not enough to override a strong name match
    const daysSinceModified = (Date.now() - file.modified) / (1000 * 60 * 60 * 24)
    if (daysSinceModified < 1)  score += 3  // modified today
    if (daysSinceModified < 7)  score += 1  // modified this week

    return { ...file, score }
  })

  return scored
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
}

module.exports = { search }
