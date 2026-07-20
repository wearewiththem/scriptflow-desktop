const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('heygenBridge', {
  uploadAudio: (apiKey, base64Audio, mimeType) =>
    ipcRenderer.invoke('heygen-upload-audio', { apiKey, base64Audio, mimeType }),
  listAvatars: (apiKey) =>
    ipcRenderer.invoke('heygen-list-avatars', { apiKey }),
  createVideo: (apiKey, payload) =>
    ipcRenderer.invoke('heygen-create-video', { apiKey, payload }),
  getVideoStatus: (apiKey, videoId) =>
    ipcRenderer.invoke('heygen-video-status', { apiKey, videoId }),
  pickFolder: () =>
    ipcRenderer.invoke('pick-folder'),
  saveVideoToFolder: (videoUrl, folderPath, filename) =>
    ipcRenderer.invoke('save-video-to-folder', { videoUrl, folderPath, filename }),
  openLogFolder: () =>
    ipcRenderer.invoke('open-log-folder'),
  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),
  fetchGoogleDocText: (docId) =>
    ipcRenderer.invoke('fetch-google-doc-text', docId)
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximizeToggle: () => ipcRenderer.send('window-maximize-toggle'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedState: (callback) => {
    ipcRenderer.on('window-maximized-state', (event, isMaximized) => callback(isMaximized));
  },
  showAboutDialog: () => ipcRenderer.invoke('show-about-dialog'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  // TEMPORÄR, nur Entwicklungsphase, siehe Kommentar in main.js
  devReplaceRendererHtml: () => ipcRenderer.invoke('dev-replace-renderer-html')
});
