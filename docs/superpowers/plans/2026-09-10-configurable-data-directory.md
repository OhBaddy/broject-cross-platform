# Configurable Broject Data Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Keep the checkboxes updated and make the milestone commits listed below.

**Goal:** Permettere all’utente desktop di scegliere la cartella in cui Broject conserva il workspace locale, includendo JSON, backup, file corrotti e log, con migrazione sicura e ripristino al riavvio.

**Architecture:** Il percorso selezionato viene salvato in una configurazione stabile nella cartella applicativa predefinita; il contenuto operativo viene risolto dal layer Rust prima di ogni `load_workspace`, `save_workspace` e `write_error_log`. Tauri espone selezione, ispezione e cambio posizione tramite comandi dedicati. Il browser fallback mantiene `localStorage` e informa chiaramente che una cartella fisica è disponibile solo nel desktop shell.

**Tech Stack:** Rust/Tauri 2, filesystem standard e dialoghi OS già usati da `reports.rs`, HTML/CSS/ES modules, Node `node:test`, test unitari Rust e smoke Playwright già presenti. Nessun nuovo package.

**Spec:** Obiettivo utente, `AGENTS.md`, `design-system/broject/MASTER.md`, `design-system/broject/pages/main-window.md` e design approvato per assunzione operativa: trasferimento predefinito, scelta esplicita fra trasferimento/uso della nuova cartella/annullamento, nessuna cancellazione automatica della copia precedente.

## Global Constraints

- Target primario: standalone Windows/Tauri; il browser deve restare avviabile senza API Tauri.
- Default invariato: `%APPDATA%\\Broject` su Windows, directory applicativa equivalente su macOS/Linux.
- Dentro la directory dati usare i nomi esistenti `broject-data.json`, `.bak`, `.corrupt` e `broject-error.log`.
- Il cambio posizione non deve perdere dati, sovrascrivere silenziosamente un workspace destinazione o lasciare il runtime puntato a una directory parzialmente copiata.
- La copia precedente viene mantenuta come fallback; non introdurre cancellazioni automatiche.
- Non aprire impostazioni mentre editor/dialoghi di modifica, export o salvataggi sono in corso; rispettare i guard esistenti per modifiche non salvate.
- Mantenere Segoe UI, palette Broject, focus visibile, controlli almeno 38px e nessuno scroll orizzontale per percorsi lunghi.
- Ogni milestone deve avere test mirati, `git diff --check` e un commit separato prima di passare alla successiva.

---

### Task 1: Aggiungere i contratti TDD per il percorso dati e il bridge

**Files:**
- Modify: `tests/tauri-contract.test.mjs`.
- Modify: `tests/native-bridge.test.mjs`.
- Modify: `src-tauri/src/storage.rs` solo per eventuali helper di test, dopo il red test.

**Interfaces:**
- Produces the expected native commands and response shape for `get_storage_location`, `choose_storage_location`, `inspect_storage_location` and `set_storage_location`.
- Defines the migration modes as stable strings: `copy` and `use-existing`.

- [x] **Step 1: Scrivere i test JavaScript rossi del bridge**

  Estendere `tests/native-bridge.test.mjs` per verificare che:

  - `getStorageLocation()` invochi `get_storage_location`;
  - `chooseStorageLocation()` invochi `choose_storage_location`;
  - `inspectStorageLocation(directory)` passi `{ directory }`;
  - `setStorageLocation(directory, mode)` passi `{ directory, mode }`;
  - in browser le operazioni restituiscano un marker `native: false` senza toccare il DOM.

- [x] **Step 2: Scrivere i test di contratto Rust rossi**

  In `tests/tauri-contract.test.mjs` verificare l’esistenza dei tipi serializzati, dei quattro comandi nel `generate_handler!`, della lettura della configurazione e del dialogo directory Windows/macOS/Linux. Verificare anche che la risposta esprima `directory`, `isDefault` e `containsWorkspace` in camelCase.

- [x] **Step 3: Eseguire i test mirati e confermare il fallimento**

  Run: `node --test tests/native-bridge.test.mjs tests/tauri-contract.test.mjs`

  Expected: FAIL perché i metodi bridge e i comandi nativi non esistono ancora.

- [x] **Step 4: Commit del contratto rosso**

  Run: `git diff --check`.

  Commit: `test: define configurable storage location contract`.

---

### Task 2: Risolvere e persistere la directory dati in Rust

**Files:**
- Modify: `src-tauri/src/storage.rs`.
- Modify: `src-tauri/src/instance.rs` solo se il lock deve seguire la configurazione stabile.
- Test: unit test Rust in `src-tauri/src/storage.rs`.

**Interfaces:**
- Consumes: existing `application_directory()`, `paths_for_directory()`, atomic JSON save/recovery.
- Produces: `configured_data_directory()`, `default_paths()`, a stable config file outside the selected data folder, and `StorageLocation`/`StorageInspection` responses.

- [x] **Step 1: Aggiungere test unitari rossi con directory temporanee**

  Coprire:

  - assenza della configurazione → ritorno alla directory applicativa predefinita;
  - configurazione valida assoluta → uso della directory selezionata;
  - configurazione vuota, relativa o JSON non valido → errore leggibile oppure fallback documentato, senza aprire un workspace vuoto sopra dati esistenti;
  - riconoscimento di primary, backup e file corrotto;
  - destinazione già contenente un `broject-data.json` valido/non valido;
  - nessuna scrittura della configurazione finché la copia non è stata validata.

- [x] **Step 2: Separare directory applicativa e directory dati attiva**

  Conservare `application_directory()` come posizione stabile di configurazione/lock. Introdurre un file dedicato, ad esempio `broject-settings.json`, con un solo campo `dataDirectory`. Non mettere il puntatore dentro la directory selezionata: così Broject può ritrovarla anche se il drive esterno non è collegato.

  `default_paths()` deve risolvere la directory configurata, mantenendo il default esistente quando il file manca.

- [x] **Step 3: Aggiungere validazione portabile del percorso**

  Accettare solo un percorso assoluto, normalizzare senza seguire un file come se fosse una directory e creare la directory solo durante un’operazione autorizzata. Separare gli errori di directory inesistente, non leggibile e non scrivibile così la UI può mostrarli vicino all’azione.

- [x] **Step 4: Implementare le risposte di ispezione**

  Restituire il percorso lossless in formato stringa, `isDefault` e `containsWorkspace`. `containsWorkspace` deve distinguere almeno primary/backup/corrupt e non basarsi soltanto sull’esistenza della directory.

- [x] **Step 5: Rieseguire i test Rust mirati e commit**

  Run: `cargo test --manifest-path src-tauri/Cargo.toml storage`.

  Expected: PASS per i nuovi test e per quelli esistenti di backup/recovery/atomicità.

  Run: `git diff --check`.

  Commit: `feat: resolve workspace data directory from persistent settings`.

---

### Task 3: Implementare selezione nativa e migrazione sicura

**Files:**
- Modify: `src-tauri/src/storage.rs`.
- Modify: `src-tauri/src/reports.rs` solo se un helper di dialogo condiviso evita duplicazione senza cambiare il comportamento export.
- Test: unit test Rust e `tests/tauri-contract.test.mjs`.

**Interfaces:**
- `choose_storage_location()` returns `Result<Option<StorageLocation>, String>`; cancel returns `None`.
- `inspect_storage_location(directory)` returns `StorageInspection` without mutation.
- `set_storage_location(directory, mode)` supports `copy` and `use-existing`.

- [x] **Step 1: Scrivere test rossi per il trasferimento**

  Verificare:

  - `copy` da sorgente a destinazione vuota copia primary, backup e corrupt presenti;
  - il file copiato è JSON valido prima che il puntatore venga pubblicato;
  - destinazione con dati esistenti non viene sovrascritta da `copy`;
  - `use-existing` non modifica la vecchia directory e rende attiva la destinazione;
  - errore durante copia/scrittura config lascia attiva la sorgente;
  - la sorgente resta intatta dopo una copia riuscita;
  - path uguali sono trattati come no-op;
  - un target non directory viene rifiutato.

- [x] **Step 2: Aggiungere il dialogo nativo di selezione directory**

  Riutilizzare il modello già usato da `reports.rs`, senza dipendenze:

  - Windows: `powershell.exe -NoProfile -STA` con `System.Windows.Forms.FolderBrowserDialog`;
  - macOS: `osascript` con `choose folder`;
  - Linux: `zenity --file-selection --directory`, fallback `kdialog --getexistingdirectory`;
  - cancel deve essere distinto da dialogo non disponibile;
  - il testo passato agli script deve essere escapato.

- [x] **Step 3: Implementare copia e pubblicazione della configurazione**

  Copiare in una directory temporanea figlia della destinazione, validare il workspace e poi pubblicare il file `broject-settings.json` con scrittura atomica. Se il target contiene già dati, restituire un errore non distruttivo e lasciare alla UI la scelta `use-existing`.

- [x] **Step 4: Far seguire il log alla directory attiva con fallback**

  `write_error_log` deve tentare prima la directory dati attiva; se è irraggiungibile deve scrivere nella directory applicativa stabile. Non loggare mai il contenuto del workspace o il percorso completo in messaggi non necessari.

- [x] **Step 5: Eseguire test Rust e commit**

  Run: `cargo test --manifest-path src-tauri/Cargo.toml`.

  Expected: PASS, inclusi backup/recovery, atomic replace, dialog helper e migrazione.

  Run: `git diff --check`.

  Commit: `feat: add safe native data-directory selection and migration`.

---

### Task 4: Esporre i comandi Tauri e aggiornare il bridge frontend

**Files:**
- Modify: `src-tauri/src/main.rs`.
- Modify: `src/core/native-bridge.mjs`.
- Test: `tests/native-bridge.test.mjs`.
- Test: `tests/tauri-contract.test.mjs`.

**Interfaces:**
- Tauri commands: `get_storage_location`, `choose_storage_location`, `inspect_storage_location`, `set_storage_location`.
- JS bridge methods: `getStorageLocation()`, `chooseStorageLocation()`, `inspectStorageLocation(directory)`, `setStorageLocation(directory, mode)`.

- [x] **Step 1: Collegare i command wrapper in `main.rs`**

  Ogni comando deve usare il modulo storage, loggare gli errori tramite il percorso di fallback e comparire in `tauri::generate_handler!`. I payload devono usare nomi camelCase lato frontend.

- [x] **Step 2: Implementare il bridge con fallback esplicito**

  Il bridge nativo inoltra i comandi e il bridge browser restituisce `{ native: false, supported: false }` per scelta/ispezione/cambio, senza simulare una directory fisica. `load()` e `save()` restano invariati.

- [x] **Step 3: Eseguire test mirati e commit**

  Run: `node --test tests/native-bridge.test.mjs tests/tauri-contract.test.mjs`.

  Expected: PASS.

  Run: `cargo check --locked --manifest-path src-tauri/Cargo.toml`.

  Expected: PASS.

  Commit: `feat: expose storage location commands through tauri bridge`.

---

### Task 5: Aggiungere impostazioni UI e flusso di cambio posizione

**Files:**
- Modify: `src/index.html`.
- Modify: `src/styles.css`.
- Modify: `src/app.mjs`.
- Test: `tests/ui-contract.test.mjs`.

**Interfaces:**
- Consumes: native bridge methods and existing modal/focus/confirmation helpers.
- Produces: accessible `#storageDialog`, sidebar location affordance, migration confirmation, loading/error/success states and reload on successful switch.

- [x] **Step 1: Scrivere test UI rossi**

  Verificare:

  - footer laterale contiene un pulsante “Cartella dati” con `aria-label`/tooltip;
  - `#storageDialog` espone percorso, stato, “Scegli cartella”, “Usa questa cartella”, “Sposta i dati” e “Annulla”;
  - il percorso lungo usa markup/stili con wrapping o ellipsis e non abilita `overflow-x`;
  - il codice usa `getStorageLocation`, `chooseStorageLocation`, `inspectStorageLocation` e `setStorageLocation`;
  - browser fallback comunica che la cartella fisica è disponibile nella versione desktop;
  - focus ritorna al pulsante sorgente e le azioni sono disabilitate durante l’operazione.

- [x] **Step 2: Eseguire il test mirato e confermare il fallimento**

  Run: `node --test tests/ui-contract.test.mjs`.

  Expected: FAIL sulle nuove asserzioni.

- [x] **Step 3: Inserire il controllo nella sidebar e il dialog**

  Trasformare il footer “Workspace locale” in un controllo accessibile che mostri un percorso breve. Nel dialog usare le superfici e i radii esistenti, testo operativo in italiano, un blocco percorso con `overflow-wrap:anywhere`, ellipsis dove appropriato e tooltip con valore completo. Aggiungere icona SVG coerente, mai emoji.

- [x] **Step 4: Implementare il flusso applicativo**

  All’apertura caricare e visualizzare la posizione nativa senza bloccare il normale startup. Selezionare una destinazione, ispezionarla, proporre la migrazione solo quando esistono dati; distinguere cancel, errore dialogo, destinazione occupata, cartella non scrivibile e successo. Prima del cambio, usare i guard esistenti per editor sporchi e impedire il comando durante export/salvataggio. Dopo successo chiudere il dialog, mostrare feedback e ricaricare così `load_workspace` riapre il workspace dalla nuova posizione.

- [x] **Step 5: Implementare browser fallback e accessibilità**

  Nel browser il dialog resta leggibile ma indica che `localStorage` continua a essere usato. Garantire focus visibile, `aria-live` per esito/errori, stato busy, `Escape`, ritorno focus e contrasto coerente alla finestra minima.

- [x] **Step 6: Eseguire test UI mirati e commit**

  Run: `node --test tests/ui-contract.test.mjs`.

  Expected: PASS.

  Run: `git diff --check`.

  Commit: `feat: add configurable data-directory settings UI`.

---

### Task 6: Documentazione, verifica standalone e audit finale

**Files:**
- Modify: `README.md`.
- Modify: `HANDOFF.md` only if the session ends before all checks.
- Modify: tests only for coverage gaps found during verification.

**Interfaces:**
- Documents default paths, Windows folder picker, migration choices, browser fallback and recovery behavior.
- Verifies that release builds do not point to localhost and that the feature is discoverable without exposing sensitive local data.

- [x] **Step 1: Aggiornare la documentazione utente**

  Documentare “Cartella dati”, default Windows, contenuto della cartella, comportamento di trasferimento e cosa fare se un drive non è disponibile. Non includere percorsi personali, token o file generati.

- [x] **Step 2: Eseguire la suite completa**

  Run: `npm test`.

  Expected: tutti i test Node PASS.

  Run: `cargo test --manifest-path src-tauri/Cargo.toml`.

  Expected: tutti i test Rust PASS. Questo repository cross-platform non contiene una soluzione `.sln`, quindi la build WPF non è applicabile qui.

  Run: `dotnet build .\\Broject.sln --configfile .\\NuGet.Config -m:1` only if the WPF solution is present in the selected workspace; otherwise record that this cross-platform repository has no `.sln`.

- [x] **Step 3: Verificare il runtime frontend**

  Avviare il server locale con `npm run dev`, usare lo smoke già presente e verificare almeno:

  - browser fallback senza Tauri;
  - footer e dialog a 1440×900 e 1080×720;
  - percorso lungo senza barra orizzontale;
  - focus da tastiera e chiusura con Escape;
  - stato disabilitato durante cambio posizione.

- [x] **Step 4: Verificare il contratto nativo standalone**

  Eseguire `cargo check --locked --release --features custom-protocol --manifest-path src-tauri/Cargo.toml` e, se l’ambiente lo permette, `cargo tauri build --ci`. Confermare che il bundle release usi `frontendDist` e non `devUrl`, e annotare esplicitamente ogni verifica Windows non eseguibile su Linux.

- [x] **Step 5: Audit sicurezza e diff**

  Controllare che config, dati runtime, `.bak`, `.corrupt`, log, `target` e `artifacts` non siano entrati nel commit. Eseguire `git diff --check`, `git status --short --branch` e una scansione mirata dei file aggiunti per segreti.

- [x] **Step 6: Commit finale e push**

  Commit: `docs: document configurable Broject data storage`.

  Push sul remote privato `origin/main` solo dopo che test, diff e audit sono verdi. Riportare gli hash di tutti i milestone commit e le eventuali limitazioni Windows reali.
