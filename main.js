const { app, BrowserWindow, ipcMain, dialog, shell, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// --- Fehlerprotokoll: einfache Logdatei im Nutzerverzeichnis, damit sich
// Probleme bei dir oder bei Kollegen nachvollziehen lassen, ohne dass ihr
// die Entwicklerkonsole öffnen müsst. ---
const logFilePath = path.join(app.getPath('userData'), 'scriptflow.log');
let lastDownloadPath = null;

function logToFile(level, message) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  try {
    fs.appendFileSync(logFilePath, line);
  } catch (err) {
    // Wenn selbst das Schreiben der Logdatei fehlschlägt, bleibt nur die Konsole
    console.error('Log konnte nicht geschrieben werden:', err);
  }
}

// --- Nur eine Instanz gleichzeitig: verhindert, dass zwei geöffnete Kopien
// sich gegenseitig die Fenstergröße oder andere lokale Dateien überschreiben. ---
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const existingWindow = BrowserWindow.getAllWindows()[0];
    if (existingWindow) {
      if (existingWindow.isMinimized()) existingWindow.restore();
      existingWindow.focus();
    }
  });
}

process.on('uncaughtException', (err) => {
  logToFile('FEHLER', `Unbehandelte Ausnahme: ${err.stack || err.message}`);
  try {
    dialog.showErrorBox(
      'Scriptflow ist auf einen Fehler gestoßen',
      `${err.message}\n\nDetails stehen im Fehlerprotokoll (Einstellungen → Verbindungen → Fehlerprotokoll öffnen).`
    );
  } catch (dialogErr) {
    // Falls sogar der Dialog fehlschlägt, bleibt zumindest der Logeintrag
  }
});
process.on('unhandledRejection', (reason) => {
  logToFile('FEHLER', `Unbehandeltes Promise: ${reason instanceof Error ? (reason.stack || reason.message) : reason}`);
});

logToFile('INFO', `Scriptflow gestartet, Version ${app.getVersion()}`);

function buildAppMenu() {
  const template = [
    {
      label: 'Scriptflow',
      submenu: [
        {
          label: 'Über Scriptflow',
          click: () => {
            const win = BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.send('show-about-overlay');
          }
        },
        {
          label: 'Nach Updates suchen',
          click: () => {
            if (!app.isPackaged) {
              dialog.showMessageBox({
                type: 'info',
                title: 'Nur in der installierten Version',
                message: 'Update-Prüfung funktioniert nur in der fertig installierten App, nicht über "npm start".'
              });
              return;
            }
            try {
              manualUpdateCheckInProgress = true;
              autoUpdater.checkForUpdates();
            } catch (err) {
              logToFile('WARNUNG', `Manuelle Update-Prüfung fehlgeschlagen: ${err.message}`);
            }
          }
        },
        {
          label: 'Fehlerprotokoll öffnen',
          click: () => shell.showItemInFolder(logFilePath)
        },
        { type: 'separator' },
        { role: 'quit', label: 'Beenden' }
      ]
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo', label: 'Rückgängig' },
        { role: 'redo', label: 'Wiederholen' },
        { type: 'separator' },
        { role: 'cut', label: 'Ausschneiden' },
        { role: 'copy', label: 'Kopieren' },
        { role: 'paste', label: 'Einfügen' },
        { role: 'selectAll', label: 'Alles auswählen' }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload', label: 'Neu laden' },
        { role: 'toggleDevTools', label: 'Entwicklertools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom zurücksetzen' },
        { role: 'zoomIn', label: 'Vergrößern' },
        { role: 'zoomOut', label: 'Verkleinern' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- Fenstergröße und Position merken ---
const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const raw = fs.readFileSync(windowStatePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { width: 980, height: 960 };
  }
}

function saveWindowState(win) {
  if (win.isMaximized()) return; // Beim Maximiert-Schließen die vorherige normale Größe behalten
  const bounds = win.getBounds();
  try {
    fs.writeFileSync(windowStatePath, JSON.stringify(bounds));
  } catch (err) {
    logToFile('WARNUNG', `Fenstergröße konnte nicht gespeichert werden: ${err.message}`);
  }
}

function createWindow() {
  const state = loadWindowState();

  const win = new BrowserWindow({
    width: state.width || 980,
    height: state.height || 960,
    x: state.x,
    y: state.y,
    minWidth: 640,
    minHeight: 600,
    backgroundColor: '#14181A',
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'scriptflow.html'));

  // --- Merkt sich, wo die zuletzt heruntergeladene Datei wirklich gelandet ist,
  // damit "Im Explorer anzeigen" den echten Ort öffnen kann statt zu raten. ---
  win.webContents.session.on('will-download', (event, item) => {
    item.once('done', (event2, state) => {
      if (state === 'completed') {
        lastDownloadPath = item.getSavePath();
        logToFile('INFO', `Datei heruntergeladen: ${lastDownloadPath}`);
      }
    });
  });

  // Links, die per window.open() aus dem Tool aufgerufen werden (z. B. "In ChatGPT
  // öffnen"), sollen im normalen System-Browser landen, nicht in einem neuen
  // Electron-Fenster ohne Adressleiste.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Eigene Titelleiste im Renderer muss wissen, ob das Fenster gerade maximiert
  // ist, um zwischen Maximieren- und Wiederherstellen-Symbol zu wechseln.
  const notifyMaximizeState = () => {
    win.webContents.send('window-maximized-state', win.isMaximized());
  };
  win.on('maximize', notifyMaximizeState);
  win.on('unmaximize', notifyMaximizeState);

  let saveTimeout = null;
  const scheduleSave = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveWindowState(win), 400);
  };
  win.on('resize', scheduleSave);
  win.on('move', scheduleSave);
  win.on('close', () => saveWindowState(win));

  return win;
}

app.whenReady().then(() => {
  // --- Lokale-Schriften-Berechtigung automatisch erteilen ---
  // Diese App ist vertrauenswürdiger, selbst installierter Code, kein fremder
  // Webseiten-Inhalt, deswegen muss das Chromium-Berechtigungsfenster für
  // "lokale Schriften auslesen" hier nicht bei jedem Nutzer einzeln aufpoppen.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'local-fonts') { callback(true); return; }
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'local-fonts';
  });

  createWindow();
  buildAppMenu();

  // --- Auto Update: prüft bei jedem Start gegen die GitHub Releases dieses
  // Repositories. Wichtig: Erst nutzbar, sobald echte Releases (nicht nur
  // Workflow Artifacts) über GitHub Actions veröffentlicht werden, siehe
  // .github/workflows/build-windows.yml und die "publish" Angabe unten in
  // package.json, dort muss "owner" auf deinen tatsächlichen GitHub
  // Nutzernamen angepasst werden. Funktioniert grundsätzlich nur in der
  // installierten exe, nicht während der Entwicklung über "npm start".
  if (app.isPackaged) {
    try {
      autoUpdater.checkForUpdates();
    } catch (err) {
      logToFile('WARNUNG', `Auto Update Prüfung fehlgeschlagen: ${err.message}`);
    }

    // Läuft die App länger im Hintergrund, ohne dass jemand sie neu startet,
    // würde sonst nie geprüft werden. Alle 4 Stunden nochmal automatisch nachsehen.
    setInterval(() => {
      try { autoUpdater.checkForUpdates(); } catch (err) { /* wird über 'error' Event geloggt */ }
    }, 4 * 60 * 60 * 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

autoUpdater.on('error', (err) => {
  logToFile('FEHLER', `Auto Update Fehler: ${err.message}`);
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-check-finished');
  // Nur bei einer von Hand ausgelösten Prüfung eine Meldung zeigen, die
  // automatische Prüfung im Hintergrund soll bei einem einzelnen Netzwerk-
  // Ausrutscher nicht ständig ein Fenster aufreißen.
  if (!manualUpdateCheckInProgress) return;
  manualUpdateCheckInProgress = false;
  const friendly = err.message.includes('No published versions')
    ? 'Für dieses Programm ist bislang keine öffentlich sichtbare Version bei GitHub hinterlegt.'
    : err.message;
  dialog.showMessageBox(win, {
    type: 'error',
    title: 'Update-Prüfung fehlgeschlagen',
    message: 'Die Prüfung auf Updates ist fehlgeschlagen.',
    detail: friendly
  });
});

// --- Update wirklich fertig heruntergeladen: jetzt erst das eigene Fenster mit
// Installieren Knopf zeigen. Klickt jemand auf Installieren, beendet sich die
// App, installiert die neue Version, und startet automatisch neu, kein
// manuelles Neu-Öffnen nötig. "Später" lässt die App normal weiterlaufen, die
// heruntergeladene Version wird beim nächsten regulären Beenden trotzdem
// automatisch installiert. ---
autoUpdater.on('update-downloaded', (info) => {
  logToFile('INFO', `Update heruntergeladen: Version ${info.version}`);
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-ready', info.version);
});

ipcMain.handle('install-update-now', () => {
  autoUpdater.quitAndInstall();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- App-Version für Splash Screen und Titelleiste ---

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('show-last-download', () => {
  if (!lastDownloadPath || !fs.existsSync(lastDownloadPath)) {
    return { ok: false, error: 'Noch keine Datei in dieser Sitzung heruntergeladen.' };
  }
  shell.showItemInFolder(lastDownloadPath);
  return { ok: true, path: lastDownloadPath };
});

// --- Eigene Titelleiste: Minimieren, Maximieren, Schließen ---
ipcMain.on('window-minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.on('window-maximize-toggle', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on('window-close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});
ipcMain.handle('window-is-maximized', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() || false;
});

// --- Aktionen aus dem "..." Menü der eigenen Titelleiste, dieselben wie im
// klassischen Anwendungsmenü, nur über das eigene UI statt Alt-Taste erreichbar ---
let manualUpdateCheckInProgress = false;

ipcMain.handle('check-for-updates', () => {
  const win = BrowserWindow.getAllWindows()[0];

  // Auto Update funktioniert grundsätzlich nur in der fertig installierten
  // exe, nicht während der Entwicklung über "npm start". Elektron-updater
  // braucht dafür Informationen, die nur beim Bauen mit electron-builder
  // erzeugt werden. Ohne diese Prüfung würde hier einfach gar nichts passieren,
  // ohne dass ersichtlich wird warum.
  if (!app.isPackaged) {
    if (win) win.webContents.send('update-check-finished');
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Nur in der installierten Version',
      message: 'Update-Prüfung funktioniert nur in der fertig installierten App.',
      detail: 'Du startest Scriptflow gerade über "npm start" zum Entwickeln, dafür gibt es keine echte Update-Prüfung. Installier die über GitHub Actions gebaute Setup-Datei, dann funktioniert das hier wie erwartet.'
    });
    return { ok: false, error: 'not-packaged' };
  }

  try {
    manualUpdateCheckInProgress = true;
    autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    manualUpdateCheckInProgress = false;
    logToFile('WARNUNG', `Manuelle Update-Prüfung fehlgeschlagen: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// Nur bei einer von Hand ausgelösten Prüfung Bescheid geben, wenn schon alles
// aktuell ist, die stille Prüfung im Hintergrund soll niemanden unterbrechen.
autoUpdater.on('update-not-available', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-check-finished');
  if (!manualUpdateCheckInProgress) return;
  manualUpdateCheckInProgress = false;
  dialog.showMessageBox(win, {
    type: 'info',
    title: 'Kein Update verfügbar',
    message: `Du hast bereits die aktuelle Version (${app.getVersion()}).`
  });
});

autoUpdater.on('update-available', () => {
  // Download läuft jetzt im Hintergrund weiter, das eigentliche Popup mit dem
  // Installieren Knopf kommt erst später über 'update-downloaded'. Die
  // Ladeanzeige beim manuellen Knopf kann trotzdem schon aufhören zu drehen,
  // der Nutzer weiß ja jetzt, dass es losgeht.
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('update-check-finished');
});

ipcMain.handle('open-log-folder', () => {
  shell.showItemInFolder(logFilePath);
  return { ok: true, path: logFilePath };
});

// --- Google Docs: reiner Text-Export ohne Google Login, funktioniert nur bei
// Dokumenten, die auf "Jeder mit Link kann ansehen" freigegeben sind. Läuft
// hier im Hauptprozess, damit Browser CORS Beschränkungen keine Rolle spielen. ---
ipcMain.handle('fetch-google-doc-text', async (event, docId) => {
  try {
    const res = await fetch(`https://docs.google.com/document/d/${docId}/export?format=txt`);
    if (!res.ok) {
      return { ok: false, error: `Dokument nicht abrufbar (${res.status}). Ist es auf "Jeder mit Link" freigegeben?` };
    }
    const text = await res.text();
    // Google liefert bei fehlender Freigabe manchmal trotzdem Status 200, aber
    // eine HTML Anmeldeseite statt echtem Text zurück, das hier fängt den
    // offensichtlichsten Fall davon ab.
    if (text.trim().startsWith('<') || text.includes('accounts.google.com')) {
      return { ok: false, error: 'Dokument scheint nicht öffentlich freigegeben zu sein (Anmeldeseite statt Text erhalten).' };
    }
    return { ok: true, text };
  } catch (err) {
    logToFile('FEHLER', `Google Doc Export fehlgeschlagen: ${err.message}`);
    return { ok: false, error: err.message };
  }
});
