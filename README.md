# Scriptflow Desktop

## Schnellstart für die Entwicklungsphase (jetzt gerade)

Solange wir noch laufend Änderungen machen, brauchst du keine gebaute exe,
das läuft direkt aus dem Quellcode, in Sekunden statt Minuten pro Version.

1. Node.js installieren, falls noch nicht vorhanden: nodejs.org, die LTS
   Version reicht.
2. Diesen ganzen Ordner `scriptflow-desktop` irgendwohin auf deinen PC
   entpacken.
3. Einmalig im Ordner ein Terminal öffnen (unter Windows z. B. Rechtsklick
   im Ordner → "In Terminal öffnen") und ausführen:
   ```
   npm install
   ```
4. Danach jedes Mal zum Starten:
   ```
   npm start
   ```

Bekommst du von mir eine neue `scriptflow.html`, zwei Möglichkeiten:

- **Direkt in der laufenden App**, über das Punkt-Menü in der Titelleiste
  → "⚠ Entwicklungsversion laden", dort die neue Datei aus deinem
  Downloads Ordner auswählen, die App lädt sich automatisch neu. Das ist
  ein absichtlich temporäres Werkzeug nur für diese Phase, wird am Ende
  wieder entfernt.
- **Von Hand**, die neue Datei einfach über `renderer/scriptflow.html`
  drüberkopieren, dann `npm start` neu ausführen.

Erst wenn eine Version wirklich fertig ist und dauerhaft bei dir (oder
Kollegen) laufen soll, lohnt sich der Umweg über eine echte gebaute exe
mit Setup Assistent und Auto Update, das steht weiter unten in diesem
Dokument.

---

Verpackt Scriptflow als eigenständige Windows Anwendung mit richtigem
Setup Assistenten (Installationsordner wählen, Desktop Verknüpfung,
Startmenü Eintrag, sauberes Deinstallieren über Windows selbst).

Der Grund für den Umweg über GitHub: Eine Windows exe zuverlässig zu
bauen braucht einen echten Windows Rechner. GitHub Actions stellt dir
das kostenlos zur Verfügung, du brauchst dafür nichts zu installieren,
nur einen kostenlosen GitHub Account.

## Einmaliges Setup (rund 5 Minuten)

1. Gehe auf github.com, leg dir einen kostenlosen Account an, falls noch
   nicht vorhanden.
2. Erstelle ein neues, privates Repository, zum Beispiel `scriptflow-desktop`.
3. Lade den kompletten Inhalt dieses Ordners dort hoch. Am einfachsten per
   Drag & Drop im Browser über "Add file" → "Upload files", oder falls du
   Git kennst:
   ```
   git init
   git add .
   git commit -m "Scriptflow Desktop"
   git branch -M main
   git remote add origin https://github.com/DEIN-NUTZERNAME/scriptflow-desktop.git
   git push -u origin main
   ```
4. Sobald der Push durch ist, startet GitHub Actions automatisch den Build.
   Das siehst du im Reiter "Actions" oben im Repository, ein gelber Punkt
   während des Laufs, ein grünes Häkchen wenn fertig, dauert meist 3 bis
   5 Minuten.
5. Klick auf den fertigen Lauf, dort unter "Artifacts" findest du
   "Scriptflow-Installer" zum Herunterladen, eine ZIP Datei mit der
   fertigen .exe drin.

## Installieren

Die heruntergeladene .exe doppelklicken, der Setup Assistent führt dich
durch Installationsordner, Verknüpfungen, und Fertigstellen. Danach
findest du Scriptflow wie jedes andere installierte Programm im
Startmenü, mit eigenem Fenster statt Browser Tab.

## Wichtiger Hinweis zu Windows SmartScreen

Weil die exe nicht mit einem kostenpflichtigen Zertifikat signiert ist,
zeigt Windows beim ersten Start vermutlich eine SmartScreen Warnung wie
"Windows hat den Start dieser App verhindert". Das ist normal bei
selbst gebauten, unsignierten Programmen, kein Hinweis auf ein Problem.
Klick auf "Weitere Informationen" und dann "Trotzdem ausführen", um es
zu starten. Ein echtes Code Signing Zertifikat kostet regulär eine
jährliche Gebühr bei Anbietern wie DigiCert oder Sectigo, lohnt sich
nur wenn du das Tool auch an andere weitergeben willst.

## Auto Update

Ab jetzt prüft die App bei jedem Start selbstständig, ob eine neuere Version
in den GitHub Releases dieses Repositories liegt, und bietet sie automatisch
zur Installation an. Damit das funktioniert, musst du einmalig in
`package.json` unter `build.publish.owner` deinen echten GitHub
Nutzernamen statt `DEIN-GITHUB-NUTZERNAME` eintragen.

Damit Auto Update greift, muss der Build über einen Versions-Tag laufen,
nicht nur über einen normalen Push:

```
git tag v1.1.0
git push origin v1.1.0
```

Der Workflow baut dann automatisch und veröffentlicht die exe als echtes
GitHub Release, das ist die Stelle, die Auto Update bei den Nutzern findet.
Ein normaler Push auf `main` baut weiterhin nur ein herunterladbares
Artifact, ohne Auto Update auszulösen.

## Fehlerprotokoll

Die App schreibt seit dieser Version automatisch eine Logdatei
(`scriptflow.log`) in ihr Nutzerverzeichnis. Über den Button
„Fehlerprotokoll öffnen" in den Einstellungen unter Verbindungen öffnest
du den entsprechenden Ordner direkt im Dateimanager, praktisch wenn ein
Kollege ein Problem meldet und du dir die Logzeilen anschauen willst.

## Zukünftige Änderungen

Wenn ich dir künftig eine neue Version von scriptflow.html schicke,
ersetzt du einfach die Datei unter `renderer/scriptflow.html` in deinem
Repository und lädst sie hoch (oder committest erneut per Git), GitHub
Actions baut dir automatisch eine neue exe daraus. Denk daran, die
Versionsnummer in `package.json` (Feld "version") und im Tool selbst
hochzuzählen, damit du den Überblick behältst.

## Projektstruktur

```
scriptflow-desktop/
├── main.js              Electron Fenster, lädt das eigentliche Tool
├── package.json          App Metadaten und Build Konfiguration
├── renderer/
│   └── scriptflow.html   Das eigentliche Tool, unverändert
├── build/
│   └── icon.ico          App Icon, aus dem Scriptflow Logo abgeleitet
└── .github/workflows/
    └── build-windows.yml Baut die exe automatisch bei jedem Push
```
