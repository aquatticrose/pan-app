const { app, BrowserWindow, ipcMain, shell, screen, globalShortcut, dialog } = require('electron')
const path = require('path')
const os = require('os')

const { buildIndex } = require('./src/core/indexer')
const { search } = require('./src/core/searcher')
const { buildSessions } = require('./src/core/sessioniser')

let Store
let store

// Use dynamic import() for ESM-only packages - works in CJS!
async function init() {
  const electronStore = await import('electron-store')
  Store = electronStore.default || electronStore

  // Initialize store
  store = new Store({
    schema: {
      folders: {
        type: 'array',
        items: { type: 'string' },
        default: [
          os.homedir() + '/Downloads',
          os.homedir() + '/Documents',
          os.homedir() + '/Desktop'
        ]
      },
      hotkey: {
        type: 'string',
        default: 'CommandOrControl+Option+P'
      }
    }
  })

  startApp()
}

let mainWindow = null
let overlayWindow = null
let dragTimeout = null
let isDragging = false

function startApp() {
  app.whenReady().then(() => {
    createWindow()

    const hotkey = store.get('hotkey')
    const registered = globalShortcut.register(hotkey, toggleWindow)

    if (!registered) {
      console.log('Global shortcut registration failed')
    } else {
      console.log('Global shortcut registered:', hotkey)
    }
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // --- IPC HANDLERS ---
  ipcMain.handle('get-folders', () => store.get('folders'))

  ipcMain.handle('pick-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Choose a folder to index',
      buttonLabel: 'Add Folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('add-folder', async (event, folderPath) => {
    const folders = store.get('folders')
    if (folders.includes(folderPath)) return folders
    const updated = [...folders, folderPath]
    store.set('folders', updated)
    buildIndex(updated)
    return updated
  })

  ipcMain.handle('remove-folder', async (event, folderPath) => {
    const folders = store.get('folders')
    const updated = folders.filter(f => f !== folderPath)
    store.set('folders', updated)
    buildIndex(updated)
    return updated
  })

  ipcMain.handle('search',         async (event, query)    => search(query))
  ipcMain.handle('get-sessions',   async ()                => buildSessions())
  ipcMain.handle('open-file',      async (event, filePath) => shell.openPath(filePath))
  ipcMain.handle('show-in-folder',       (event, filePath) => shell.showItemInFolder(filePath))
  ipcMain.on('hide-window',              ()                => { if (mainWindow) mainWindow.hide() })
}

function createOverlay() {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.bounds

  overlayWindow = new BrowserWindow({
    width, height, x: 0, y: 0,
    transparent: true, frame: false,
    alwaysOnTop: true, skipTaskbar: true,
    focusable: false, resizable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })

  overlayWindow.setIgnoreMouseEvents(true)
  overlayWindow.loadFile('overlay.html')
  overlayWindow.hide()
  overlayWindow.on('closed', () => { overlayWindow = null })
}

function showOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.show()
}

function hideOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide()
}

function trySnap(win) {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workArea
  const [winWidth, winHeight] = win.getSize()
  const [winX, winY] = win.getPosition()

  const snapX = Math.round(width / 2 - winWidth / 2)
  const snapY = Math.round(height / 2 - winHeight / 2)
  const dist = Math.sqrt(
    Math.pow(winX + winWidth / 2 - width / 2, 2) +
    Math.pow(winY + winHeight / 2 - height / 2, 2)
  )
  if (dist < 100) win.setPosition(snapX, snapY, true)
}

function toggleWindow() {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    clearTimeout(dragTimeout)
    isDragging = false
    hideOverlay()
    mainWindow.hide()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 680, height: 520, center: true,
    frame: false, transparent: true, resizable: false,
    vibrancy: 'under-window', visualEffectState: 'active', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })

  mainWindow.loadFile('dist/index.html')

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    createOverlay()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    const folders = store.get('folders')
    buildIndex(folders)
    console.log('Indexing folders:', folders)
  })

  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow.hide()
  })

  mainWindow.on('move', () => {
    clearTimeout(dragTimeout)
    if (!isDragging) { isDragging = true; showOverlay() }
    dragTimeout = setTimeout(() => {
      isDragging = false
      if (mainWindow && !mainWindow.isDestroyed()) trySnap(mainWindow)
      hideOverlay()
    }, 200)
  })
}

// Start everything
init()