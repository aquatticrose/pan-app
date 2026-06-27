const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('panAPI', {
  search:       (query)      => ipcRenderer.invoke('search', query),
  getSessions:  ()           => ipcRenderer.invoke('get-sessions'),
  openFile:     (filePath)   => ipcRenderer.invoke('open-file', filePath),
  showInFolder: (filePath)   => ipcRenderer.invoke('show-in-folder', filePath),
  hideWindow:   ()           => ipcRenderer.send('hide-window'),

  // Folder management
  getFolders:   ()           => ipcRenderer.invoke('get-folders'),
  pickFolder:   ()           => ipcRenderer.invoke('pick-folder'),
  addFolder:    (folderPath) => ipcRenderer.invoke('add-folder', folderPath),
  removeFolder: (folderPath) => ipcRenderer.invoke('remove-folder', folderPath),
})