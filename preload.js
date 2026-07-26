const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  openLogFolder: () =>
    ipcRenderer.invoke('open-log-folder'),
  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),
  fetchGoogleDocText: (docId) =>
    ipcRenderer.invoke('fetch-google-doc-text', docId),
  showLastDownloadInFolder: () =>
    ipcRenderer.invoke('show-last-download')
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximizeToggle: () => ipcRenderer.send('window-maximize-toggle'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedState: (callback) => {
    ipcRenderer.on('window-maximized-state', (event, isMaximized) => callback(isMaximized));
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onShowAboutOverlay: (callback) => {
    ipcRenderer.on('show-about-overlay', () => callback());
  }
});
