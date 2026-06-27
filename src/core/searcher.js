const { getIndex } = require('./indexer')

// These are the words users might type to describe a time period
// We map them to a number of milliseconds in the past
const TIME_HINTS = {
  'just now':    1000 * 60 * 30,         // 30 minutes
  'today':       1000 * 60 * 60 * 24,    // 24 hours
  'last night':  1000 * 60 * 60 * 24,    // treat same as today
  'yesterday':   1000 * 60 * 60 * 48,    // 48 hours
  'last week':   1000 * 60 * 60 * 24 * 7,// 7 days
  'this week':   1000 * 60 * 60 * 24 * 7,
  'last month':  1000 * 60 * 60 * 24 * 30
}

// These are words users might type to describe a file type
// We map them to actual file extensions
const TYPE_HINTS = {
  'pdf':      ['pdf'],
  'doc':      ['doc', 'docx'],
  'document': ['doc', 'docx', 'pdf'],
  'image':    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
  'photo':    ['jpg', 'jpeg', 'png', 'heic'],
  'video':    ['mp4', 'mov', 'avi', 'mkv'],
  'audio':    ['mp3', 'wav', 'aac', 'm4a'],
  'spreadsheet': ['xlsx', 'xls', 'csv'],
  'code':     ['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css'],
  'zip':      ['zip', 'rar', '7z', 'tar', 'gz'],
}

// The main search function
// query = whatever the user typed, e.g. "pdf from last night"
function search(query) {
  // If the user typed nothing, return nothing
  if (!query || query.trim() === '') return []

  const index = getIndex()

  // Convert the query to lowercase so matching isn't case-sensitive
  // "PDF" and "pdf" should behave the same
  const q = query.toLowerCase()

  // Split the query into individual words
  // "pdf from last night" → ["pdf", "from", "last", "night"]
  const words = q.split(' ').filter(w => w.length > 1)

  // Figure out if the user hinted at a time period
  // We check if the full query contains any of our known time phrases
  let timeLimit = null
  for (const [phrase, ms] of Object.entries(TIME_HINTS)) {
    if (q.includes(phrase)) {
      // timeLimit is a timestamp — any file older than this gets penalised
      timeLimit = Date.now() - ms
      break
    }
  }

  // Figure out if the user hinted at a file type
  let typeFilter = null
  for (const [hint, exts] of Object.entries(TYPE_HINTS)) {
    if (q.includes(hint)) {
      typeFilter = exts
      break
    }
  }

  // Now score every file in the index
  const scored = index.map(file => {
    let score = 0
    const nameLower = file.name.toLowerCase()

    // --- Name matching ---
    // Check each word in the query against the filename
    for (const word of words) {
      // Skip common words that aren't useful for matching
      if (['from', 'the', 'a', 'an', 'last', 'night', 'week', 'that', 'my', 'pdf', 'doc', 'image'].includes(word)) continue

      if (nameLower.includes(word)) {
        score += 10 // strong signal — the word appears in the filename

        // Extra points if the filename *starts* with this word
        // "notes.pdf" matches "notes" better than "lecture_notes.pdf" does
        if (nameLower.startsWith(word)) score += 5
      }
    }

    // --- File type matching ---
    if (typeFilter) {
      if (typeFilter.includes(file.ext)) {
        score += 8 // file type matches what the user described
      } else {
        score -= 20 // wrong type — push it way down the results
      } 
    }

   // --- Time matching ---
// If the user mentioned a time phrase, treat it as a hard filter.
// Files outside the time window are excluded entirely — score goes
// to -1 so they get cut by the filter(f => f.score > 0) at the end.
// Files inside the window get a boost for being relevant to the time described.
if (timeLimit) {
  if (file.modified >= timeLimit) {
    score += 12 // inside the window — reward it
  } else {
    score = -1  // outside the window — exclude it completely
    return { ...file, score }
  }
}

    return { ...file, score }
    // { ...file } copies all the file's properties (name, path, etc.)
    // then we add the score on top
  })

  // Filter out files with a score of 0 or less — they're not relevant
  // Then sort by score, highest first
  // Then return only the top 20 results (no one needs to see 500 results)
  return scored
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
}

module.exports = { search }