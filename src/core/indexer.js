const fs = require("fs");
const path = require("path");

// This will hold all our indexed files in memory
// It's just an array of objects, one per file
let fileIndex = [];

// This is the main function — call it with a folder path
// and it will walk through every file inside (including subfolders)
function indexFolder(folderPath) {
  // Try to read the folder — if we don't have permission, skip it
  let entries;
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
  } catch (err) {
    return; // skip folders we can't read
  }

  for (const entry of entries) {
    // Build the full path to this entry
    const fullPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      // If it's a folder, go inside it (this is called "recursion")
      // Skip hidden folders like .git or node_modules — they're not user files
      const BLOCKED_FOLDERS = [
        "node_modules",
        ".git",
        ".svn",
        ".hg",
        "__pycache__",
        ".cache",
        "Library",
        "System",
        "private",
        "proc",
        "dev",
      ];
      if (
        !entry.name.startsWith(".") &&
        !BLOCKED_FOLDERS.includes(entry.name)
      ) {
        indexFolder(fullPath);
      }
    } else if (entry.isFile()) {
      // Skip hidden files — any file starting with . is hidden
      // from the user in Finder, so hide it from pan too
      if (entry.name.startsWith(".")) continue;

      // Skip system and junk files by name
      const BLOCKED_NAMES = [
        "Thumbs.db",
        "desktop.ini",
        "Icon\r",
        ".localized",
        "hiberfil.sys",
        "pagefile.sys",
      ];
      if (BLOCKED_NAMES.includes(entry.name)) continue;

      // Skip junk file extensions — these are never user files
      const BLOCKED_EXTENSIONS = [
        "tmp",
        "temp",
        "log",
        "lock",
        "cache",
        "swp",
        "swo", // vim swap files
        "DS_Store", // just in case
        "pyc", // Python compiled files
        "class", // Java compiled files
        "o",
        "obj", // C/C++ object files
      ];
      const ext = path.extname(entry.name).toLowerCase().replace(".", "");
      if (BLOCKED_EXTENSIONS.includes(ext)) continue;

      try {
        const stats = fs.statSync(fullPath);
        fileIndex.push({
          name: entry.name,
          path: fullPath,
          ext: path.extname(entry.name).toLowerCase().replace(".", ""), // e.g. "pdf"
          size: stats.size, // size in bytes
          modified: stats.mtimeMs, // last modified, as a number (milliseconds)
        });
      } catch (err) {
        // Skip files we can't read
      }
    }
  }
}

// Call this to start indexing — pass it an array of folder paths
// e.g. buildIndex(['/Users/aqua/Downloads', '/Users/aqua/Documents'])
function buildIndex(folders) {
  fileIndex = []; // reset before each run
  for (const folder of folders) {
    indexFolder(folder);
  }
  console.log(`Indexed ${fileIndex.length} files`);
  return fileIndex;
}

// Returns the current index — used by searcher.js later
function getIndex() {
  return fileIndex;
}

module.exports = { buildIndex, getIndex };
