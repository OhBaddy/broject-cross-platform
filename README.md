# Broject cross-platform

Replica multipiattaforma di Broject WPF. Directory separata, WPF originale non modificata.

## Architettura

- Tauri 2 per packaging Windows, Linux e macOS.
- Rust in `src-tauri/` per shell desktop, persistenza JSON locale con backup/recovery, lock di singola istanza e comandi Tauri `load_workspace`/`save_workspace`.
- Export report nativo con dialogo di salvataggio e apertura tramite applicazione predefinita (`save_report`/`open_report`); se il dialogo OS non è disponibile, il browser usa automaticamente il download locale.
- UI vanilla HTML/CSS/ES modules in `src/`, senza framework o font remoti.
- Test Node built-in per comportamento deterministico del core UI e compatibilità dello schema dati.

La UI mantiene canvas 1480×900, minimo 1080×720, Segoe UI, shell laterale scura, palette Broject e copy italiana dell’app esistente.

## Sviluppo locale

```bash
npm test
npm run dev
```

Apri `http://127.0.0.1:4173` per controllare la shell browser. Per eseguire Tauri servono Rust/Cargo e il CLI Tauri:

```bash
npx --yes @tauri-apps/cli@^2 dev
npx --yes @tauri-apps/cli@^2 build
```

Il bundle include già l’asset macOS `src-tauri/icons/icon.icns`, generato dalla stessa icona Broject e verificato dal contratto Tauri. Se l’icona sorgente cambia, rigenerare gli asset con il comando ufficiale:

```bash
cargo tauri icon src-tauri/icons/icon.png
```

La lista `bundle.icon` contiene PNG, ICO e ICNS. Rust stable 1.98.1 e il CLI Tauri 2.11.4 sono stati verificati in ambiente Linux: `cargo check --release --features custom-protocol`, `cargo test --release` (10/10), il runtime Tauri e il bundle Debian passano. La verifica nativa su Windows e macOS richiede comunque quei sistemi.

È verificato anche il cross-build release Windows `x86_64-pc-windows-gnu`: l’eseguibile PE standalone è disponibile in `artifacts/Broject_3.0.0_windows_x64.exe` e l’installer NSIS in `artifacts/Broject_3.0.0_windows_x64-setup.exe`. Il standalone deve essere prodotto da `tauri build` oppure da Cargo con la feature `custom-protocol`; un plain `cargo build --release` viene rifiutato dal guard Rust perché userebbe `devUrl` e richiederebbe localhost. Per ripetere il bundling su un host Linux è consigliato installare `nsis` e `nsis-common`; la prova runtime, WebView2 e la firma richiedono un host Windows.

Build manuale dello standalone Windows cross-target:

```bash
cargo build --locked --release --target x86_64-pc-windows-gnu \
  --features custom-protocol --manifest-path src-tauri/Cargo.toml
cp src-tauri/target/x86_64-pc-windows-gnu/release/broject.exe \
  artifacts/Broject_3.0.0_windows_x64.exe
```

Su Ubuntu/Debian, prima del build nativo:

```bash
sudo apt-get update
sudo apt-get install -y pkg-config libdbus-1-dev libwebkit2gtk-4.1-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev
```

Il bundle Linux verificato viene creato con:

```bash
CARGO_BUILD_JOBS=1 CARGO_INCREMENTAL=0 npx --yes @tauri-apps/cli@^2 build --bundles deb
```

Il lock Unix di singola istanza usa permessi `0600`; directory dati e log usano permessi riservati all’utente.

Su Linux il dialogo nativo usa `zenity` o, in alternativa, `kdialog`; senza nessuno dei due l’export ricade sul download browser. Su Windows usa `SaveFileDialog` via PowerShell e su macOS `osascript`; anche questi due percorsi hanno il medesimo fallback browser se il comando OS non è disponibile.

La persistenza nativa usa `%APPDATA%/Broject` su Windows, `~/Library/Application Support/Broject` su macOS e `$XDG_CONFIG_HOME/Broject` (oppure `~/.config/Broject`) su Linux. I dati locali e i backup Unix vengono creati con permessi riservati all’utente.

## Cartella dati

Dal pulsante `Cartella dati` in fondo alla sidebar desktop puoi scegliere dove Broject conserva il workspace locale. Su Windows la posizione predefinita è `%APPDATA%\\Broject`; la cartella contiene `broject-data.json`, il backup `.bak`, l’eventuale copia `.corrupt` e `broject-error.log`.

La configurazione della posizione resta nella directory applicativa predefinita, così Broject può ritrovare il percorso selezionato anche dopo il riavvio. Quando scegli una nuova cartella puoi:

- usare i dati già presenti nella destinazione;
- copiare il workspace attuale in una cartella vuota e poi renderla attiva;
- annullare l’operazione.

La copia viene controllata prima di pubblicare la nuova posizione, la cartella precedente non viene cancellata e i file di recupero vengono conservati. Se la cartella configurata non è disponibile, Broject blocca l’avvio senza creare un workspace vuoto: ricollega il drive e premi `Riprova`, oppure ripristina una cartella dati valida.

Nel browser la persistenza resta in `localStorage`, perché una pagina web non può scegliere una cartella fisica. Per configurare una directory del computer usa la versione desktop.

## Download Windows

Gli artefatti Windows aggiornati sono disponibili direttamente nel repository:

- [Installer NSIS](artifacts/Broject_3.0.0_windows_x64-setup.exe) — installazione guidata;
- [Portable ZIP](artifacts/Broject_3.0.0_windows_x64-portable.zip) — estrai la cartella e avvia `Broject.exe`;
- [Standalone EXE](artifacts/Broject_3.0.0_windows_x64.exe) — tieni accanto anche `WebView2Loader.dll` se lo usi fuori dal portable ZIP.

Serve Microsoft WebView2 Runtime, normalmente già presente su Windows 10 e 11. Gli artefatti sono build non firmate: Windows potrebbe mostrare un avviso SmartScreen al primo avvio.
