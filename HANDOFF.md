# Handoff — Broject cross-platform

Data: 2026-09-09

## Obiettivo

Ricreare Broject WPF in una directory separata, con una shell Tauri 2 cross-platform per Linux, Windows e macOS, mantenendo requisiti, comportamento, copy e UI dell’app originale. Il progetto WPF originale non è stato modificato.

Directory di lavoro:

`/home/ohbaddy/workspace/ays-broject-local-main/broject-cross-platform`

## Stato corrente

### Rifinitura UI, report Excel, shortcut e guida — 2026-09-09

È stato completato l’audit runtime di tutte le superfici del client cross-platform: Overview, Progetto/Bacheca, Elenco, Settimana, Il mio lavoro, Persone, Report, ricerca, guida e drawer attività. Le correzioni applicate sono:

- `.task-stack` ora usa `grid-auto-rows: max-content` e `align-content: start`, quindi le card non si stirano fino a riempire la colonna quando ci sono pochi task;
- la griglia Settimana usa colonne minime da 150px: a 1440×900 mostra tutti i giorni, a 1080×720 conserva lo scroll orizzontale invece di comprimere o tagliare il calendario;
- `?` apre una guida strutturata con navigazione, attività, ricerca, report, recovery e shortcut; il dialog è scrollabile alla dimensione minima, ha etichette ARIA e ripristina il focus;
- sono disponibili `Ctrl/Cmd+1..4` per le sezioni, `Ctrl/Cmd+Shift+B/L/W` per Bacheca/Elenco/Settimana e `?` oltre a `F1`; i comandi non interrompono la scrittura nei campi testo;
- il tema XLSX è stato rifatto con header indigo/navy, font bianchi sui fondi scuri, slate/amber/emerald/red per gli stati, contrasti più forti e bordi sottili; il conteggio `cellXfs` del file XML ora è corretto;
- il piano dettagliato è in `docs/superpowers/plans/2026-09-09-ui-report-shortcuts-guide.md`.

Verifiche di questo ciclo: `npm test` 9 file verdi, smoke browser completo positivo con Playwright/Chromium a 1080×720, audit visivo completo a 1080×720 e 1440×900, e test XLSX sul tema e sui bordi. Il runtime Playwright ha richiesto esecuzione fuori dal sandbox perché il Chromium Snap locale falliva in `snap-confine`; non è un errore dell’app.

### Correzione standalone Windows — 2026-09-09

Il primo standalone consegnato era stato ricompilato con `cargo build --release` senza la feature Tauri `custom-protocol`. In Tauri questo lascia attiva la modalità sviluppo e l’EXE cercava `http://127.0.0.1:4173`; per questo su Windows non partiva autonomamente.

La causa è stata riprodotta con una regression test e corretta con un guard Rust che rifiuta ogni release build senza `custom-protocol` (la modalità debug per `tauri dev` resta disponibile). Lo standalone è stato rigenerato con:

```bash
cargo build --locked --release --target x86_64-pc-windows-gnu --features custom-protocol --manifest-path src-tauri/Cargo.toml
```

L’EXE distribuito ora viene copiato esclusivamente da `src-tauri/target/x86_64-pc-windows-gnu/release/broject.exe`. Nuovo SHA-256: `e618cbc69dbb9e05904f4eb782d2c4a33d06db9c8a20f40d9a3297edca15703d`.

La replica è composta da:

- frontend vanilla HTML/CSS/ES modules in `src/`;
- backend Rust/Tauri in `src-tauri/`;
- persistenza JSON locale con backup/recovery e scrittura atomica;
- report XLSX generati offline e salvati tramite bridge nativo quando disponibile;
- fallback al download browser se il dialogo di salvataggio nativo non è disponibile.

La parte frontend/core è in uno stato funzionante. Rust stable `1.98.1`, Cargo ha generato `src-tauri/Cargo.lock` e le dipendenze native Linux sono disponibili. `cargo check --release` passa, i test Rust passano 10/10, il runtime Tauri Linux reale ha creato la finestra con il titolo corretto e il CLI Tauri 2.11.4 ha prodotto il bundle Linux `src-tauri/target/release/bundle/deb/Broject_3.0.0_amd64.deb`. Sono verificati anche il cross-build Windows standalone e l’installer NSIS in `artifacts/`. Il packaging dichiarativo include PNG, ICO e ICNS: `src-tauri/icons/icon.icns` è stato generato dalla stessa icona Broject con `tools/generate-icns.py` e il contratto verifica l’header e la lunghezza del contenitore. Restano da verificare i runtime reali su Windows e macOS, oltre all’installazione Linux su sistema reale.

Stima complessiva: circa 90%. La parità osservabile di frontend/core è intorno al 90%+, la compilazione e il packaging Linux/Windows sono verificati; il gate residuo è la verifica runtime reale su Windows/macOS, l’installazione Linux e l’audit OS-specifico finale.

Checkpoint aggiornato: 2026-09-09. Sono stati aggiunti logging degli errori runtime, asset icona Broject nel bundle Tauri, guard Tauri `CloseRequested` con scarto/salvataggio delle modifiche task, copy WPF per il fallimento di avvio nativo e per l’errore runtime nativo, copy esatto per l’errore data e per il `DateValidationError` al blur, percorso WPF di creazione rapida che apre Nuovo progetto quando il workspace è vuoto, guard informativo WPF quando si tenta di creare un task senza progetto, copy WPF per aggiornamento persona, recupero Undo ed errori/apertura report, tooltip WPF per ricerca globale, creazione rapida, modifica persona, salvataggio task e recupero, ripristino del focus dopo lo spostamento di un task, dopo l’eliminazione di un task e dopo la chiusura della ricerca con pulsante o `Esc`, preservazione della ricerca durante `UndoDelete`, nomi accessibili per tabella Elenco, filtri, selettore report, barra export, ricerca progetto e navigazione settimana, stato live dell’editor e campi del drawer, navigazione a frecce nella lista progetti, no-op alle estremità, sincronizzazione della selezione quando si esce dalla sezione Progetto, no-op del drop nella colonna dello stesso stato, stato vuoto Elenco senza intestazione tabella e reset filtri sempre visibile/disabilitato senza filtri. È stato aggiunto anche il calendario locale del `DatePicker` WPF: pulsante calendario, navigazione mensile, selezione date-only, chiusura con Escape e integrazione con il formato `gg/mm/aaaa`. È stato aggiunto un contratto automatico che legge i literal `AutomationProperties.Name`/`ToolTip` dal WPF e impedisce che la replica perda quel copy. L’intervallo settimana dell’overview ora segue esattamente il formato WPF (`dd MMM — dd MMM yyyy`), senza prefisso aggiuntivo. Sono stati inoltre allineati Undo progetto/task all’ordine e alla validazione assignee del WPF, il ripristino di `CompletedAt` per status non validi, l’ordinamento per display name degli assignee nei report portfolio, i nomi accessibili dei campi progetto/persona/note report e il titolo WPF `Broject — il lavoro, finalmente chiaro` sia nel documento sia nella finestra Tauri. L’audit di questo ciclo ha verificato che `AddRiskTable` WPF ordina solo per scadenza; non è stato mantenuto un tie-break aggiuntivo nella replica. I gap reali sono stati riprodotti e corretti con TDD.

Aggiornamento finale del checkpoint: il template KPI è stato riallineato al WPF come card solo testuali a tre righe, senza icone aggiuntive e con `min-height: 96px`.

Aggiornamento successivo: la ricerca ora ordina con confronto ordinal-ignore-case deterministico come `StringComparer.OrdinalIgnoreCase` WPF, senza dipendere dalla locale del sistema, mentre gli ordinamenti generali mantengono la collation italiana prevista dalla UI. Sono stati inoltre riallineati i controlli visivi WPF: frecce `‹/›`, pulsante testuale `Apri`, intestazioni Elenco maiuscole, `+ Aggiungi persona`, `+`/`?` del topbar, chiusure `×` e Guida rapida senza il controllo header extra assente dal `MessageBox` WPF. Il logging nativo protegge la directory applicativa Unix con permessi `0700` anche quando il log viene scritto prima del primo salvataggio.

Aggiornamento bootstrap: Tauri ora viene rilevato prima di costruire il fallback `localStorage`; una webview desktop può quindi avviare il bridge Rust anche quando lo storage browser non è disponibile. Il fallback browser resta invariato quando l’app gira fuori da Tauri.

Aggiornamento selezione: l’inizializzazione, il quick-create e il post-eliminazione progetto scelgono ora il primo progetto per nome con collation italiana, come `RefreshProjectNavigation` WPF; questo mantiene coerenti progetto attivo, selettore report e creazione rapida anche quando l’ordine persistito differisce.

Aggiornamento parity e fallback: il riepilogo carico Persone usa ora il fallback WPF `Senza nome` anche per anagrafiche senza nome; i tre form di salvataggio disattivano la validazione HTML nativa per lasciare sempre il controllo e il copy alle routine WPF-equivalenti; gli errori di avvio dei dialoghi nativi di salvataggio report espongono un marker riconosciuto dal fallback browser su Windows, macOS e Linux.

Aggiornamento nomi report: `SafeFileName` ora conserva gli spazi come il WPF, sostituisce solo i caratteri vietati Windows carattere per carattere e usa `Progetto` come fallback per un nome vuoto; lo smoke export verifica anche il nome del progetto attivo con spazi.

Aggiornamento accessibilità: la barra di avanzamento progetto espone ora il ruolo `progressbar`, il range 0–100 e `aria-valuenow` sincronizzato con la percentuale visualizzata, incluso lo stato senza progetto.

Aggiornamento verifica visiva: `tools/ui-smoke.mjs` salva ora anche `artifacts/ui-smoke-overview-1080.png` nello stato Overview iniziale, così il controllo della finestra minima non dipende da uno screenshot storico con KPI precedenti.

Aggiornamento recovery nativo: quando primary e backup sono illeggibili, il backend Rust ora conserva il copy WPF completo con il percorso della directory dati e l’istruzione di ripristino (`I file sono stati conservati in ... Ripristina una copia valida prima di riaprire l’app.`). Il contratto Tauri dedicato è passato da 10/10 a 11/11.

Aggiornamento dirty-dialog: i dialoghi Progetto e Persona usano ora una conferma interna accessibile, con focus visibile su `No, continua`, pulsante esplicito `Sì, esci` e gestione Escape; lo smoke genera anche `artifacts/ui-smoke-unsaved-dialog-1080.png`, controllato visivamente alla finestra minima. Il contratto UI è passato da 60/60 a 61/61.

Aggiornamento packaging macOS: è stato aggiunto `src-tauri/icons/icon.icns`, generato riproducibilmente da `src-tauri/icons/icon.png` con `tools/generate-icns.py`; `src-tauri/tauri.conf.json` dichiara ora PNG, ICO e ICNS. In quel checkpoint il contratto Tauri era passato da 11/11 a 12/12; oggi è 15/15 e la compilazione/bundle Linux sono verificati.

Aggiornamento toolchain Linux: Rust stable `1.98.1`, Cargo e `rustfmt` sono disponibili. Dopo l’installazione di `pkg-config`, DBus, WebKitGTK 4.1, XDO e AppIndicator, `cargo check --release` passa senza warning; `cargo test` passa 10/10 con `CARGO_BUILD_JOBS=1` e `CARGO_INCREMENTAL=0`.

Aggiornamento action-confirm: eliminazioni di attività, progetto e persona e la scelta WPF “Report esportato correttamente. Vuoi aprirlo ora?” usano ora un dialogo interno riutilizzabile con titoli, copy, pulsanti Sì/No, Escape e focus iniziale su No; non dipendono più da `confirm()` del browser. Il contratto UI è passato da 61/61 a 63/63 includendo una regressione sul focus Escape; lo smoke salva `artifacts/ui-smoke-action-confirm-1080.png` e verifica il ritorno su `deleteTaskButton`.

Aggiornamento runtime Linux: il binario Tauri estratto direttamente dal `.deb` è stato avviato su `DISPLAY=:10.0` con una directory dati temporanea isolata; il processo ELF è rimasto vivo, la finestra `Broject — il lavoro, finalmente chiaro` è stata rilevata dal display e il lock Unix è stato verificato con permessi `0600`. Una seconda istanza contro lo stesso lock ha mostrato il dialogo Zenity `Broject: Broject è già aperto.` e non ha aperto una seconda finestra. È stata aggiunta una regressione al contratto Tauri per impedire che il lock torni a essere world-readable.

Aggiornamento cross-target: sono stati installati gli standard library Rust per `x86_64-pc-windows-gnu`, `x86_64-apple-darwin` e `aarch64-apple-darwin`. Con MinGW/binutils estratto user-local in `/tmp`, `cargo check --target x86_64-pc-windows-gnu` passa senza warning, includendo Tauri/WebView2 e i rami `cfg(windows)` del backend. Il check macOS ha compilato i crate Apple fino a `objc2-exception-helper` e si è fermato perché il `cc` Linux non supporta `-arch`/SDK macOS. Per la prova definitiva dell’app servono comunque un host Windows e un host macOS.

Storico Windows release: il primo tentativo con MinGW è stato fermato da `No space left on device`; il build plain `cargo build --locked --release --target x86_64-pc-windows-gnu` era riuscito ma produceva lo standalone in modalità sviluppo e il suo SHA-256 `15e137cc977d46e857ae93ba2ec66a4d871d100719ccb84f66efb441de139008` non è più valido per la consegna. Il `.deb` Linux è stato rigenerato e verificato con SHA-256 `d298fe0bfc14dba5535656dfd1f05aa73f9de7d5193b8f044e86f98ace3fc9d3`.

Il bundler Tauri NSIS è stato completato con gli stub NSIS estratti user-local, senza modifiche di sistema. L’installer PE32 x86 è salvato in [`artifacts/Broject_3.0.0_windows_x64-setup.exe`](artifacts/Broject_3.0.0_windows_x64-setup.exe), SHA-256 `473baaf6721288fe19c3483183dde0683833d8f32ece383dbeda12fead2d5a1c`. La firma è stata saltata perché il build avviene su Linux; la verifica runtime definitiva richiede comunque Windows/WebView2.

Verifica artefatti finale: `file` identifica il nuovo standalone come `PE32+ executable (GUI) x86-64`, con `WebView2Loader.dll` tra le importazioni e sottosistema Windows GUI; l’installer resta `PE32 executable (GUI) Intel 80386`; il bundle Linux è `Debian binary package (format 2.0)`. `dpkg-deb` conferma `Package: broject`, `Version: 3.0.0`, `Architecture: amd64`, dipendenze `libwebkit2gtk-4.1-0`/`libgtk-3-0` e `Installed-Size: 11921`. Il target Windows corretto è stato mantenuto per audit della provenienza; restano circa 1,9 GiB liberi.

Decisione di consegna aggiornata: il bug segnalato sullo standalone è stato corretto e l’artefatto è stato rigenerato con il protocollo embedded. Restano da fare solo le verifiche runtime su un host Windows reale/WebView2, oltre alle verifiche macOS/Linux già indicate sotto.

Interruzione corrente: sono stati chiusi entrambi i percorsi WPF di chiusura ricerca, il recupero WPF dopo `UndoDelete` con tooltip, i percorsi distinti di creazione rapida/task senza progetto, il focus WPF su `Aggiungi attività` dopo l’eliminazione, i messaggi WPF di errore export/report non apribile, i messaggi nativi di avvio/runtime, la validazione WPF del `DatePicker` al blur, il calendario DatePicker locale, la guida all’utilizzo strutturata con shortcut, il copy del toast dopo lo spostamento task, il percorso `Salva e chiudi` con validazione WPF, il copy di recupero degli errori di salvataggio Progetto/Persona con live region assertiva, le dimensioni minime dei dialoghi Progetto/Persona/Note report, i nomi accessibili WPF di tabella/filtri/report/export e dei dialoghi e i nomi accessibili dello stato progetto, della settimana e del drawer task. È stato verificato anche il guard di Escape dei dialoghi Progetto/Persona con modifiche non salvate, in linea con il `Closing` WPF. Il guard Tauri simulato ha verificato `preventDefault` + `destroy` sul percorso task dirty. L’audit automatico dei literal WPF è positivo e il contratto dell’intervallo settimana ha intercettato/corretto il prefisso non presente nel WPF. Test statici, suite completa, suite timezone e smoke browser sono positivi; lo screenshot 1080×720 non mostra regressioni evidenti dopo il fix delle dimensioni. Non ci sono modifiche di produzione parziali da completare.

Ultima verifica: dopo la correzione Escape del dialogo action-confirm e del packaging Windows passano la suite completa, la suite `TZ=America/Los_Angeles`, i controlli sintattici, `ui-contract 63/63`, `tauri-contract 15/15` e lo smoke browser completo; lo smoke ha rigenerato `artifacts/ui-smoke-1080.png`, `artifacts/ui-smoke-overview-1080.png`, `artifacts/ui-smoke-unsaved-dialog-1080.png` e `artifacts/ui-smoke-action-confirm-1080.png`, con verifica visiva della finestra minima a 1080×720.

Ultimo ciclo di verifica: `ui-contract` 63/63, `tauri-contract` 15/15, query workspace 5/5, suite Node 9 file verdi in due timezone, sintassi verde, smoke browser completo positivo e smoke runtime Tauri Linux positivo dopo le correzioni di parity testuale, accessibilità, screenshot, asset macOS, dialoghi di conferma, gestione Escape modale, permessi del lock Unix, target desktop completi e guard release `custom-protocol`. Gli ultimi test coprono anche il caso che aveva causato il bug: una release Cargo senza protocollo embedded ora fallisce esplicitamente.

Riesecuzione di questa sessione: i test Node, i contratti, `cargo fmt`, `cargo check` release con `custom-protocol` e `cargo test` release (10/10) sono verdi. `npm run ui-smoke` non è stato rieseguito perché il workspace non contiene il pacchetto `playwright` (`ERR_MODULE_NOT_FOUND`); gli screenshot già presenti derivano dall’ultimo smoke positivo e la UI non è stata modificata in questo fix.

Aggiornamento nativo finale: `cargo fmt --check`, `cargo check --release --features custom-protocol --manifest-path src-tauri/Cargo.toml` e `cargo test --release --manifest-path src-tauri/Cargo.toml` passano; il test Rust restituisce 10/10. Il controllo negativo `cargo check --release --no-default-features` fallisce intenzionalmente con il messaggio sulla feature `custom-protocol`. `npx --yes @tauri-apps/cli@^2 --version` restituisce `tauri-cli 2.11.4`; `CARGO_BUILD_JOBS=1 CARGO_INCREMENTAL=0 npx --yes @tauri-apps/cli@^2 build --bundles deb` produce un pacchetto Debian valido per `amd64`, con dipendenze `libwebkit2gtk-4.1-0`. Il build `x86_64-pc-windows-gnu` corretto passa senza warning con MinGW estratto user-local e produce SHA-256 `e618cbc69dbb9e05904f4eb782d2c4a33d06db9c8a20f40d9a3297edca15703d`. Il contratto Tauri aggiornato passa 15/15, verifica che tutti i target desktop siano abilitati e protegge anche il lock Unix con `0600`. Per rendere i test di contratto robusti al formatter Rust, le regex Tauri ora tollerano firme e `format!` multilinea.

## Lavoro completato

### UI e parity WPF

- overview con greeting/hint, KPI, focus task, attività recenti e limiti WPF;
- Board, Elenco, Settimana, Il mio lavoro, Persone, Report e drawer editor task;
- ordinamento task coerente con WPF: stato, priorità decrescente, scadenza, titolo;
- ricerca su task, progetti e persone, con gruppi nascosti quando vuoti;
- card People/workload con carico e barra percentuale;
- filtro `Tutte`/`Non assegnate` in Il mio lavoro;
- barra laterale progetto con badge separato del conteggio attività aperte, come nel WPF;
- header progetto con barra avanzamento, percentuale e stato allineati al WPF;
- barra avanzamento progetto con semantica accessibile `progressbar`, range 0–100 e valore aggiornato anche nello stato vuoto;
- percentuale header progetto con copy WPF esatto: `N% completato`;
- sottotitoli topbar per Overview, Project, My Work, People e Reports allineati ai valori WPF;
- pulsante `+` nella card Progetti dell’overview per aprire Nuovo progetto;
- apertura delle righe progetto con doppio click o Enter; il click singolo resta inerte;
- azioni progetto `Esporta`, `Modifica`, `Elimina`, con controllo read-only durante export;
- stato vuoto e fallback descrizione progetto allineati al WPF;
- scadenza task con contratto italiano `gg/mm/aaaa`, validazione di date impossibili e conservazione date-only;
- controllo calendario della scadenza allineato al `DatePicker` WPF, con navigazione mensile, selezione locale e chiusura da tastiera;
- errore scadenza del salvataggio con il copy WPF esatto di `SaveTask_Click`;
- errore `DateValidationError` al blur con il valore inserito e il copy WPF esatto;
- calendario locale della scadenza con pulsante, navigazione mensile, selezione date-only e chiusura Escape;
- selettore assegnatari collassabile con riepilogo live e chiusura tramite Escape;
- selettore progetto task disabilitato quando esiste un solo progetto;
- dialog Progetto, Persona, Note report e Guida con copy, etichette, avatar, pulsanti e recovery allineati;
- dimensioni dei dialoghi Progetto, Persona e Note report allineate ai vincoli WPF: larghezze 540/580/620px e `min-height` 400/470/420px;
- guida all’utilizzo dal pulsante `?`, con sezioni operative, recovery, shortcut e scroll interno;
- `formnovalidate` sui pulsanti Annulla/Chiudi dei dialoghi Progetto e Persona, così il dialogo si può chiudere anche con il campo obbligatorio vuoto;
- errori di salvataggio Progetto/Persona con il prefisso WPF `Salvataggio non riuscito. I dati restano qui:` e annuncio live assertivo;
- form di salvataggio con `novalidate`: gli attributi `required` restano disponibili per semantica/accessibilità, ma gli errori vengono sempre gestiti dal copy WPF-equivalente;
- card KPI con template WPF testuale a tre righe, senza icone, con `min-height: 96px`;
- ricerca con ordinamento ordinal-ignore-case deterministico equivalente a `WorkspaceQuery` WPF;
- controlli text-only WPF per frecce task/settimana, pulsante `Apri`, intestazioni Elenco, `+ Aggiungi persona` e chiusure `×`;
- topbar/sidebar con i glyph WPF `+` e `?`, e guida all’utilizzo con chiusura accessibile e ripristino del focus;
- shortcut `Ctrl/Cmd+1..4` per le sezioni e `Ctrl/Cmd+Shift+B/L/W` per le viste progetto, protette durante l’inserimento testo;
- card Bacheca compatte e calendario Settimana responsive, senza stretching o clipping alla larghezza standard;
- tema XLSX ad alto contrasto con header indigo/navy, stati slate/ambra/emerald/rosso e bordi sottili verificati nel `styles.xml` generato;
- dialog per modifiche task non salvate con `Annulla`, `Scarta` e `Salva`;
- il percorso `Salva e chiudi` del dialogo modifiche non salvate delega alla validazione task WPF e non al vincolo HTML del browser;
- conferma delle modifiche task non salvate prima di cambiare progetto o aprire un’altra attività;
- guard `beforeunload` anche per dialog Progetto/Persona con campi modificati;
- card Persona con fallback WPF `Nessun ruolo specificato`; risultati Persona della ricerca mantengono ordine, avatar e barra carico WPF (barra a 0%);
- testo del carico Persone con fallback WPF `Senza nome` per persone prive di nome e cognome;
- card Persona con avatar 42×42, dettaglio a 12px e pulsante Modifica alto almeno 38 DIP come nel WPF;
- palette avatar Persona allineata alla sequenza colori WPF e separatore date overview allineato all’em dash WPF;
- label delle persone assegnabili nel formato WPF `Nome - Ruolo - Azienda`, con ordinamento per cognome/nome;
- focus return, focus trap, `inert`, `aria-hidden`, `aria-busy` e fallback a elemento visibile;
- dopo lo spostamento di un task, il focus viene ripristinato sulla card riprodotta e la card è raggiungibile come elemento focusabile;
- le frecce di spostamento del TaskCard restano visibili e disabilitate ai bordi, come `CanMovePrevious`/`CanMoveNext` nel WPF;
- lo stato disabilitato delle frecce conserva l’opacità/affordance visiva dei controlli WPF;
- il toast dopo lo spostamento conserva il copy WPF `“Titolo” ora è ...`;
- dopo la chiusura della ricerca, il focus viene ripristinato su `globalSearch`, come `ClearSearch_Click` nel WPF;
- anche la scorciatoia `Esc` della ricerca ripristina `globalSearch`, come il comando `CloseEditorCommand` del WPF;
- `Annulla eliminazione` mantiene aperta la ricerca e la ricalcola dopo il ripristino, come `UndoDelete_Click` nel WPF;
- la tabella Elenco espone `aria-label="Attività del progetto"`, equivalente a `AutomationProperties.Name` del `DataGrid` WPF;
- ricerca progetto, frecce della settimana, stato live dell’editor e controlli del drawer task espongono i nomi accessibili WPF equivalenti;
- filtri Stato/Persona, selettore progetto report e barra di avanzamento export espongono i nomi automation WPF equivalenti;
- l’azione `Annulla eliminazione` conserva il tooltip di recupero WPF e lo verifica nello smoke browser;
- i tooltip delle azioni principali conservano il copy WPF (`Cerca...`, `Crea`, `Modifica persona`, `Salva (Ctrl+S)`);
- la chiusura nativa Tauri intercetta `CloseRequested`, blocca export/task/dialog dirty e forza la chiusura solo dopo una decisione valida;
- il fallback browser dell’export riconosce anche il fallimento di avvio del dialogo nativo su Windows, macOS e Linux;
- i nomi report progetto seguono `SafeFileName` WPF: spazi conservati, caratteri Windows vietati sostituiti con `-`, fallback `Progetto`;
- il drop di un task nella colonna del suo stato corrente non salva né mostra un toast, come il guard `DropTask` WPF;
- quando l’Elenco non ha attività visibili, la tabella viene nascosta e resta il solo empty state WPF;
- `Azzera filtri` resta visibile ma disabilitato senza filtri, e si abilita quando ricerca/stato/persona sono attivi;
- l’azione globale `Crea` apre `Nuovo progetto` quando non esistono progetti, mentre `Aggiungi attività` mantiene il guard informativo WPF;
- Undo progetto ripristina le attività in coda nello stesso ordine del WPF e Undo task scarta gli assignee non più esistenti;
- status non validi vengono normalizzati a `Todo` e perdono `CompletedAt`, come nel normalizer WPF;
- gli assignee dei report portfolio sono ordinati per display name come nel `PortfolioReportBuilder` WPF;
- i campi Nome progetto, Descrizione progetto e Note finali report espongono i nomi accessibili WPF equivalenti;
- la navigazione della lista progetti gestisce `ArrowUp`, `ArrowDown`, `Home` e `End`, mantiene il focus sulla riga corretta, lascia invariati i filtri ai bordi e rimuove `is-selected` quando la sezione attiva non è Progetto;
- scorciatoie `Ctrl+K`, `Ctrl+N`, `Ctrl+S`, `Esc`, `F1`, con blocco durante drawer/dialog/export;
- guard `beforeunload` mentre un export è in corso, l’editor task è dirty o un dialog Progetto/Persona è dirty.

### Core, date e report

- `src/core/dashboard-query.mjs` contiene query e formattazione condivise, inclusi `parseItalianDate` e `formatItalianDate`;
- `src/core/reporting.mjs` usa date locali per scadenze, overdue, due soon, ordinamenti e settimana;
- `src/core/xlsx.mjs` usa la stessa regola locale per date e rischi;
- nomi file report con timestamp locale `yyyyMMdd_HHmm`;
- overview con label WPF per completate settimanali (`ddd HH:mm`) e attività recenti (tempo relativo `Adesso`, `min fa`, `h fa`, `g fa` o `dd MMM`);
- copy overview/My Work/Report allineato ai testi WPF, inclusi `Attività recente`, empty state Doing e nota Excel/LibreOffice;
- overview statico allineato al WPF (`Il lavoro di oggi`, hint iniziale, card settimanale senza sottotitolo extra e attività `Ultime attività aggiornate`);
- calendario allineato al layout WPF: frecce e intervallo a sinistra, `Settimana corrente` a destra, giorni `Lun`/`Mar`/… con capitale iniziale;
- card/lista/calendario task con barra e label di stato, badge priorità, colori di sfondo WPF e label compatta degli assegnatari;
- shell dimensionata come WPF: sidebar 220px, topbar 68px e area contenuti `calc(100vh - 68px)`;
- copy di salvataggio, eliminazione task e aggiornamento progetto riallineato ai messaggi WPF;
- stato di errore fatale all’avvio dello storage: overlay `Avvio non riuscito`, messaggio `I dati locali non sono stati modificati.`, shell inert/aria-hidden e focus automatico su `Riprova`;
- errori frontend inattesi e `unhandledrejection` intercettati, inoltrati al log nativo `broject-error.log` tramite `log_error` e annunciati con il copy WPF di recupero;
- filtro della settimana completata con limite locale esclusivo sul giorno successivo, come nel WPF;
- drawer task con label autonoma `Persone assegnate` sopra il picker e affordance `Seleziona` a destra;
- report portfolio/progetto con dashboard, registry, persone, kanban, task list, note, metriche, stili, merge, freeze panes e stati vuoti;
- rischi del workbook progetto ordinati per scadenza, come `AddRiskTable` WPF;
- controlli esistenti su ZIP XLSX e XML parsabile.

### Storage e backend nativo

- schema JSON locale con compatibilità PascalCase, migrazione del vecchio singolo assegnatario, normalizzazione e riparazione riferimenti a ID duplicati;
- backup `.bak`, conservazione `.corrupt`, recupero dal backup e log errore;
- persistenza atomica: `rename` su Unix, `MoveFileExW` con replace/write-through su Windows;
- percorsi OS-specifici: `%APPDATA%/Broject`, `~/Library/Application Support/Broject`, `$XDG_CONFIG_HOME/Broject` o `~/.config/Broject`;
- fallback robusto per variabili ambiente vuote e valori XDG non assoluti;
- permessi user-only su directory dati, file temporanei, backup, lock di single-instance (`0600`) e log Unix;
- `write_error_log` applica `0700` alla directory applicativa Unix anche nel percorso di logging iniziale;
- single-instance con mutex nominato Windows e lock file `flock` su Unix/macOS;
- dialog salvataggio Linux con `zenity`/`kdialog`, apertura con `xdg-open`/`gio`/KDE, Windows tramite `explorer.exe`, macOS tramite AppleScript;
- titolo del dialogo export passato end-to-end dal frontend al backend: `Esporta report generale` e `Esporta report progetto`;
- validazione nativa del package XLSX: firma ZIP e presenza delle entry `[Content_Types].xml` e `xl/workbook.xml` prima del dialogo/salvataggio;
- normalizzazione Rust del payload WPF in ingresso/uscita: schema minimo 3, PascalCase/camelCase, ID duplicati/vuoti riparati in formato UUID compatibile con `Guid`, riferimenti progetto/persona, enum e assignee legacy;
- fallback nativo quando un backend dialog fallisce o non è installato;
- comando nativo `log_error` registrato nel router Tauri per gli errori runtime del frontend;
- messaggi nativi di avvio fallito ed errore runtime allineati al copy WPF, inclusa la nota sul file `broject-error.log` e sulla conservazione delle modifiche confermate;
- report scritti senza cancellazione preventiva del file esistente su Windows.

### Wiring Tauri aggiunto nell’ultima sessione

`src-tauri/tauri.conf.json` ora dichiara:

- `beforeDevCommand: npm run dev`;
- `devUrl: http://127.0.0.1:4173`;
- `frontendDist: ../src`.
- titolo finestra/documento: `Broject — il lavoro, finalmente chiaro`.

Il contratto `save_report` accetta anche il titolo del dialogo e lo inoltra ai dialoghi Windows/macOS/Linux.

## Verifiche eseguite

Verifiche locali riuscite all’ultimo checkpoint:

```text
npm test                         9 file verdi
TZ=America/Los_Angeles npm test  9 file verdi
node --check src/app.mjs && node --check tools/ui-smoke.mjs  verdi
ui-smoke Playwright              passato con DateValidationError al blur, project surface, guard, dialog, export, focus post-move e no-op same-column verificati
```

Dopo le correzioni runtime/startup/focus/navigation sono stati eseguiti direttamente anche:

```text
node tests/ui-contract.test.mjs       63/63
node tests/native-bridge.test.mjs      6/6
node tests/tauri-contract.test.mjs     15/15
node --check src/app.mjs               verde
node --check tools/ui-smoke.mjs        verde
```

Il controllo UI contract aggiornato al termine dell’ultimo fix è `63/63`; il controllo Tauri è `15/15`; `npm test` resta a 9 file verdi anche con `TZ=America/Los_Angeles`.

Il controllo browser mirato ha restituito:

```text
projectSurface: projectSearchLabel Cerca attività nel progetto; previousWeekLabel Vai alla settimana precedente; nextWeekLabel Vai alla settimana successiva
drawerState: editorStateLive polite; 9 etichette WPF equivalenti verificate
busyState: visible true, appInert true, ariaBusy true, progressLabel Esportazione in corso
tauriCloseGuard: prevented true, destroyed 1, drawerOpen false
arrowDown: Keyboard B, focus sulla riga Keyboard B
arrowUp: Keyboard A, focus sulla riga Keyboard A
overviewSelection: 0
moveFocus: ARTICLE, stato In corso, focus sulla card spostata
edgeArrowSearch: edge-check
sameColumnDrop: toastVisible false, stato In corso
emptyListState: tableHidden true, emptyVisible true, resetDisabled true
searchFocus: globalSearch
escapeSearchFocus: globalSearch
quickCreateEmpty: Nuovo progetto
deleteFocus: addTaskButton
undoSearch: query UI smoke dated task, resultCount 1, searchVisible true, tooltip Ripristina l’ultima eliminazione di questa sessione, undoHidden true
tableLabel: Attività del progetto
```

Il controllo dialoghi ha inoltre verificato `reportNotesDialog.accessibleName: Note finali del report, facoltative`.
Il controllo iniziale ha verificato anche il titolo `Broject — il lavoro, finalmente chiaro`.
L’audit XLSX ha confermato che `AddRiskTable` WPF ordina i rischi solo per scadenza, senza tie-break aggiuntivo; lo smoke completo ha confermato i tre percorsi di export senza regressioni.

Lo smoke completo più recente ha verificato anche il `blur` di una data impossibile (`31/02/2026`) e il messaggio dinamico `La scadenza ‘31/02/2026’ non è valida. Usa gg/mm/aaaa oppure cancella il campo.`. Dopo l’aggiornamento della semantica `progressbar`, lo smoke completo è passato di nuovo con i tre export XLSX e gli screenshot `artifacts/ui-smoke-1080.png` e `artifacts/ui-smoke-overview-1080.png` rigenerati; l’Overview iniziale è stato controllato visivamente alla finestra minima.

Dopo l’allineamento KPI e dei controlli text-only lo smoke completo ha ripetuto senza errori il percorso UI già coperto, inclusi calendario DatePicker, guard, focus, dialoghi ed export; lo screenshot è stato aggiornato e controllato visivamente.

È stato inoltre eseguito un controllo runtime isolato con `broject:primary = "null"`: overlay startup visibile, focus su `retryStartupButton`, shell inert e `aria-hidden="true"`.

Il gate nativo Linux è stato verificato esplicitamente: dipendenze di sistema, compilazione Rust, unit test e bundle Debian passano.

```text
rustc --version                                      -> rustc 1.98.1
cargo --version                                      -> cargo 1.98.1
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check -> verde
cargo check --release --manifest-path src-tauri/Cargo.toml -> verde senza warning
cargo test --manifest-path src-tauri/Cargo.toml     -> 10 passed; 0 failed
npx @tauri-apps/cli@^2 --version                    -> tauri-cli 2.11.4
npx @tauri-apps/cli@^2 build --bundles deb          -> bundle Debian amd64 creato
```

Artefatto verificato:

[`src-tauri/target/release/bundle/deb/Broject_3.0.0_amd64.deb`](src-tauri/target/release/bundle/deb/Broject_3.0.0_amd64.deb) — pacchetto Debian 2.0, architettura `amd64`, dipendenze runtime `libwebkit2gtk-4.1-0` e `libgtk-3-0`.

Il comando `apt` eseguito dall’utente ha installato `pkg-config`, `libdbus-1-dev`, `libwebkit2gtk-4.1-dev`, `libxdo-dev` e `libayatana-appindicator3-dev`; `librsvg2-dev` non risulta installato ma non ha impedito il bundle `.deb`. Dopo la pulizia della cache pip e il build Windows restano circa 2,7 GiB liberi; prima di un nuovo build nativo eseguire `cargo clean --manifest-path src-tauri/Cargo.toml` se necessario.

I test coprono query dashboard, bridge nativo, reporting, contratto UI, workspace, storage e XLSX. La suite in timezone `America/Los_Angeles` verifica anche che le date-only non slittino di giorno.

È disponibile lo screenshot aggiornato del controllo visuale a 1080×720:

- [`artifacts/ui-smoke-1080.png`](artifacts/ui-smoke-1080.png)
- [`artifacts/ui-smoke-overview-1080.png`](artifacts/ui-smoke-overview-1080.png)
- [`artifacts/ui-smoke-unsaved-dialog-1080.png`](artifacts/ui-smoke-unsaved-dialog-1080.png)
- [`artifacts/ui-smoke-action-confirm-1080.png`](artifacts/ui-smoke-action-confirm-1080.png)

### Stato dello smoke UI

Lo smoke completo ha verificato app iniziale, progetti, azioni progetto, distribuzione stato, drawer, autofocus, focus trap, Escape, focus return, date e `DateValidationError` al blur, ricerca, label assegnatari, guard di chiusura/navigazione con modifiche task non salvate, dialogo interno dirty di Progetto e Persona con focus su `No, continua`, dialog Persona/Guida/Note report, busy/export guard e tre export XLSX. Durante il ciclo è stato corretto il blocco del pulsante Annulla del dialog Persona causato dalla validazione HTML del campo Nome obbligatorio, aggiungendo `formnovalidate`.

L’ultimo smoke completo ha restituito `navigationGuard: true`, `unsavedClose: true`, `projectCloseGuard: true`, drawer con autofocus su `taskTitle`, `editorStateLive: polite`, calendario scadenza aperto/navigato/selezionato e chiuso con `Escape`, 9 nomi accessibili verificati, trap attivo, shell inert durante export, `busyState.progressLabel: Esportazione in corso`, `tauriCloseGuard.prevented: true`, `tauriCloseGuard.destroyed: 1`, 3 export XLSX, nomi accessibili di ricerca progetto e navigazione settimana, `sameColumnDrop.toastVisible: false`, `emptyListState.tableHidden: true`, `emptyListState.resetDisabled: true`, `emptyListState.tableLabel: Attività del progetto`, `searchFocus: globalSearch`, `escapeSearchFocus: globalSearch`, `undoSearch.resultCount: 1`, tooltip di recupero esatto e ricerca ancora visibile, oltre a `artifacts/ui-smoke-1080.png`; è passato dopo i fix del no-op nella stessa colonna, delle frecce disabilitate ai bordi del TaskCard, dello stato vuoto Elenco, del reset filtri, dei due percorsi di chiusura della ricerca, di `UndoDelete`, dei nomi accessibili di tabella/filtri/report/export, del drawer, dei tooltip WPF, del `DateValidationError` al blur, del calendario DatePicker, dei messaggi di errore dialoghi, del guard chiusura Tauri e dei vincoli dimensionali dei dialoghi. Ora `tools/ui-smoke.mjs` verifica permanentemente frecce abilitate/disabilitate, edge no-op, selezione Overview, stato vuoto Elenco, reset filtri, nomi accessibili di DataGrid/drawer/editor/export, focus post-move, focus dopo chiusura ricerca con pulsante e `Esc`, recupero Undo con ricerca attiva/tooltip, calendario DatePicker, validazione data al blur, guard `CloseRequested` simulato e drop nella stessa colonna.

Comando usato e passato:

```bash
BROJECT_PLAYWRIGHT_MODULE=/home/ohbaddy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs \
BROJECT_CHROMIUM=/snap/bin/chromium \
npm run ui-smoke
```

Se non c’è un server già attivo nella prossima sessione, avviare prima `npm run dev` e aprire `http://127.0.0.1:4173`.

## Limiti e punti aperti

Priorità alta:

1. Verificare davvero su Windows, Linux e macOS:

   - avvio e single-instance;
   - percorsi dati e permessi;
   - workspace corrotto e recupero backup;
   - dialog save/open e fallback browser;
   - comportamento report con Excel/LibreOffice;
   - packaging/installazione Tauri.

   Linux è già compilabile e impacchettato in `target/release/bundle/deb/Broject_3.0.0_amd64.deb`; manca la prova su una installazione Linux reale e la verifica Windows/macOS.

   Il check condizionale Windows passa con `binutils-mingw-w64-x86-64` e il toolchain MinGW; per un build/install reale restano WebView2 e un host Windows. macOS richiede Xcode/SDK Apple o un runner macOS.

2. Se cambia `src-tauri/icons/icon.png`, rigenerare e verificare l’ICNS:

   ```bash
   python3 tools/generate-icns.py
   test -f src-tauri/icons/icon.icns
   ```

3. Lo smoke Playwright e lo smoke mirato sono passati dopo l’ultima correzione; se vengono modificati frontend o markup, rilanciarli e controllare il nuovo screenshot.

L’audit mirato iniziale aveva indicato sei aree: frecce nella lista progetti, focus dopo `MoveTask`, selezione delle righe progetto fuori dalla sezione Progetto, drop nella stessa colonna, stato vuoto dell’Elenco e reset filtri. Tutte e sei, incluso il comportamento ai bordi, ora hanno test statici e verifica browser positiva.

Priorità media/bassa:

- confrontare modal, DPI, scroll e dimensione minima 1080×720 con WPF;
- completare audit di contrasto, screen reader, focus e stati disabled/loading/error/empty;
- rifinire eventuali differenze residue di toast/error copy e undo bar;
- controllare CSP, capabilities, icone, signing, dipendenze WebKitGTK e `Cargo.lock` durante i test OS-specifici;
- valutare in seguito se spostare la generazione XLSX dal frontend a comandi Rust; al momento il writer JS preserva il contratto workbook e il path è gestito dal native bridge.

## File principali

- [`src/app.mjs`](src/app.mjs) — orchestrazione UI, dialoghi, eventi, export e focus;
- [`src/index.html`](src/index.html) — shell e markup dei dialoghi;
- [`src/styles.css`](src/styles.css) — palette/layout/focus/modal/workload;
- [`src/core/dashboard-query.mjs`](src/core/dashboard-query.mjs) — query, date e snapshot UI;
- [`src/core/workspace-service.mjs`](src/core/workspace-service.mjs) — CRUD, undo e validazione riferimenti/assignee;
- [`src/core/workspace-store.mjs`](src/core/workspace-store.mjs) — normalizzazione schema, enum e metadati di completamento;
- [`src/core/reporting.mjs`](src/core/reporting.mjs) — snapshot report e date locali;
- [`src/core/xlsx.mjs`](src/core/xlsx.mjs) — writer XLSX offline;
- [`src-tauri/src/storage.rs`](src-tauri/src/storage.rs) — storage nativo e path/permessi;
- [`src-tauri/src/reports.rs`](src-tauri/src/reports.rs) — save/open report, dialog e scrittura atomica;
- [`src-tauri/src/instance.rs`](src-tauri/src/instance.rs) — single-instance e messaggio già aperto;
- [`tools/generate-icns.py`](tools/generate-icns.py) — rigenerazione riproducibile dell’asset ICNS dalla PNG sorgente;
- [`tools/ui-smoke.mjs`](tools/ui-smoke.mjs) — smoke browser completo;
- [`docs/compatibility-matrix.md`](docs/compatibility-matrix.md) — matrice di compatibilità aggiornata.

## Rimanente — priorità Windows

1. Su un host Windows con WebView2, provare sia lo standalone corretto [`artifacts/Broject_3.0.0_windows_x64.exe`](artifacts/Broject_3.0.0_windows_x64.exe) sia l’installer [`artifacts/Broject_3.0.0_windows_x64-setup.exe`](artifacts/Broject_3.0.0_windows_x64-setup.exe), quindi avviare Broject e verificare:

   - avvio, titolo `Broject — il lavoro, finalmente chiaro` e dimensione minima;
   - single-instance e messaggio `Broject è già aperto.`;
   - `%APPDATA%/Broject`, backup/recovery, permessi e workspace corrotto;
   - dialoghi Save/Open report, fallback browser e apertura con app predefinita;
   - export XLSX con Excel e comportamento di chiusura con modifiche non salvate;
   - DPI/scaling, tastiera, focus, disabled/loading/error/empty state e screen reader;
   - firma del binario/installer, se richiesto per la distribuzione.

   Artefatti Windows verificati localmente:

   - standalone corretto con protocollo embedded: SHA-256 `e618cbc69dbb9e05904f4eb782d2c4a33d06db9c8a20f40d9a3297edca15703d`;
   - installer NSIS: SHA-256 `473baaf6721288fe19c3483183dde0683833d8f32ece383dbeda12fead2d5a1c`.

2. Solo dopo Windows, eseguire la stessa smoke OS-specifica su macOS (bundle `.app`/DMG, `~/Library/Application Support/Broject`, dialoghi, single-instance, permessi e WebKit) e su Linux installando il `.deb`.

3. Se emergono differenze su un host reale, modificare solo il percorso OS interessato e ripetere i contratti UI/Tauri, la suite Node, i test Rust e lo smoke browser prima di rigenerare gli artefatti.

## Ripresa consigliata

1. Leggere questo file e `docs/compatibility-matrix.md`.
2. Primo comando: `df -h /`; non ricompilare se il disco è quasi pieno e non cancellare `artifacts/`. Per Windows non usare mai un plain `cargo build --release`: usare `npx --yes @tauri-apps/cli@^2 build` oppure aggiungere esplicitamente `--features custom-protocol`.
3. Per la priorità corrente, eseguire la checklist Windows nella sezione precedente.
4. Se cambia frontend o markup, ripetere `node tests/ui-contract.test.mjs`, `node tests/tauri-contract.test.mjs`, `npm test`, `TZ=America/Los_Angeles npm test` e lo smoke completo.
5. Dopo eventuali test OS-specifici, aggiornare questo file con esiti, errori e hash degli artefatti rigenerati.

Nota di checkpoint: l’ultimo ciclo ha chiuso anche il copy WPF completo per il recovery dei dati illeggibili, oltre a `SafeFileName` WPF per i report, il fallback `Senza nome` del carico Persone, la validazione WPF-equivalente dei tre form senza blocco HTML, il marker comune per il fallback browser quando il dialogo nativo non si avvia e la semantica accessibile della percentuale progetto. Restano chiusi i gap startup-failure, logging runtime frontend, copy errore data, calendario DatePicker, errori di salvataggio Progetto/Persona, template KPI WPF, confronto ricerca ordinal-ignore-case, controlli text-only task/settimana/Elenco/persona/dialoghi, validazione XLSX, normalizzazione nativa, focus dopo move e chiusura ricerca con pulsante/`Esc`, preservazione ricerca in `UndoDelete`, nome accessibile della tabella Elenco, navigazione a frecce, edge no-op, selezione Overview, drop same-column, stato vuoto Elenco, reset filtri, percorsi no-project, ordine Undo progetto/task, status invalidi, assignee portfolio, label accessibili dei dialoghi, vincoli dimensionali dei dialoghi, titolo finestra/documento, guard Escape dei dialoghi, bootstrap Tauri indipendente da `localStorage` e selezione progetto alfabetica come WPF, senza modificare il WPF originale. Il backend Rust compila e testa su Linux e il bundle `.deb` è stato prodotto; mancano le verifiche reali su Windows, Linux installato e macOS.

Regola operativa permanente: quando il contesto raggiunge circa il 70%, interrompere l’implementazione, aggiornare questo `HANDOFF.md` con stato, verifiche, errori e prossimo comando, quindi fermarsi. Non lasciare modifiche parziali non documentate.

Le verifiche runtime su Windows/macOS/Linux restano raccomandate per la distribuzione, ma per il perimetro concordato non bloccano la consegna del goal.
