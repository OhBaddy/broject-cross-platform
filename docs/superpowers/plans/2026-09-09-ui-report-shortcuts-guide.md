# UI Audit, Report Theme, Shortcuts and Help Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rifinire tutte le schermate del client cross-platform, rendere i report Excel più leggibili e sofisticati, aggiungere shortcut coerenti e trasformare il comando `?` in una guida d’uso consultabile.

**Architecture:** Le correzioni visuali restano in `src/styles.css` e `src/index.html`; la gestione delle shortcut resta centralizzata in `src/app.mjs` e viene protetta dai contesti di input/modale già presenti. Il tema Excel resta incapsulato in `src/core/xlsx.mjs`, con test sul workbook generato per evitare che i colori tornino a essere solo una convenzione non verificata.

**Tech Stack:** HTML/CSS/ES modules, Tauri-compatible browser shell, Node `node:test`, writer XLSX locale senza nuove dipendenze, Playwright/Chromium già disponibile nell’ambiente.

**Spec:** User request in conversation plus `AGENTS.md`, `design-system/broject/MASTER.md`, and `design-system/broject/pages/main-window.md`.

## Global Constraints

- Target primario: client desktop Windows/Tauri; il browser shell deve mantenere lo stesso comportamento.
- Nessun nuovo package o servizio remoto.
- Copy e guida in italiano; i dati restano local-first.
- Mantenere Segoe UI, focus visibile, accessibilità da tastiera, conferme sulle azioni distruttive e stati vuoti/loading/error già esistenti.
- Verificare le schermate principali a 1440×900 e alla dimensione minima 1080×720.
- Non modificare il WPF originale per questa tornata: il lavoro riguarda `broject-cross-platform`.

---

### Task 1: Correggere i difetti di layout rilevati nell’audit

**Files:**
- Modify: `src/styles.css:247,262`.
- Test: `tests/ui-contract.test.mjs`.
- Verify: screenshot Playwright temporanei per overview, bacheca, elenco, settimana, il mio lavoro, persone, report, ricerca, guida e drawer.

**Interfaces:**
- Consumes: classi `.task-stack`, `.calendar-grid` e i breakpoints già presenti.
- Produces: card di bacheca dimensionate sul contenuto e calendario che mostra tutte le sette colonne senza clipping alla larghezza standard, mantenendo lo scroll quando necessario.

- [x] **Step 1: Aggiungere i contratti CSS che descrivono i due difetti osservati**

  In `tests/ui-contract.test.mjs`, aggiungere un test che legga `styles.css` e richieda:

  ```js
  assert.match(styles, /\.task-stack\s*\{[^}]*align-content:\s*start/);
  assert.match(styles, /\.task-stack\s*\{[^}]*grid-auto-rows:\s*max-content/);
  assert.match(styles, /\.calendar-grid\s*\{[^}]*minmax\(150px/);
  ```

- [x] **Step 2: Eseguire il test mirato e verificare che fallisca sui CSS attuali**

  Run: `node --test tests/ui-contract.test.mjs`

  Expected: FAIL sulle nuove asserzioni, perché oggi `.task-stack` non controlla l’allineamento verticale e `.calendar-grid` usa colonne minime da 170px.

- [x] **Step 3: Applicare la correzione minima**

  Aggiornare `.task-stack` con `align-content: start` e `grid-auto-rows: max-content`; aggiornare la griglia calendario alla dimensione minima che consente di vedere la settimana nella shell standard, lasciando `overflow-x: auto` come fallback per 1080×720.

- [x] **Step 4: Rieseguire il test mirato**

  Run: `node --test tests/ui-contract.test.mjs`

  Expected: PASS.

- [x] **Step 5: Verificare visivamente entrambe le risoluzioni**

  Aprire ogni project view con dati seed: la Bacheca deve avere card compatte senza blocchi vuoti; Settimana deve mostrare anche Domenica oppure uno scroll orizzontale intenzionale, mai una colonna tagliata senza affordance.

---

### Task 2: Trasformare `?` in una guida operativa accessibile

**Files:**
- Modify: `src/index.html:267-274`.
- Modify: `src/styles.css:412-419` e relative media query.
- Test: `tests/ui-contract.test.mjs`.

**Interfaces:**
- Consumes: `openHelpDialog()` e `rememberDialogFocus()` già usati da `app.mjs`.
- Produces: dialog `#helpDialog` con sezioni navigabili, testo operativo, tabella shortcut e chiusura che mantiene focus.

- [x] **Step 1: Sostituire il test legacy che vieta la guida estesa**

  Rimpiazzare `help dialog does not add controls absent from the WPF message surface` con asserzioni sul nuovo contratto:

  ```js
  assert.match(helpDialog, /Guida all’utilizzo/);
  assert.match(helpDialog, /Navigazione/);
  assert.match(helpDialog, /Attività/);
  assert.match(helpDialog, /Report Excel/);
  assert.match(helpDialog, /Scorciatoie/);
  assert.match(helpDialog, /class="help-list"/);
  assert.match(helpDialog, /Ctrl\+K/);
  assert.match(helpDialog, /aria-label="Chiudi guida"/);
  ```

  Mantenere anche il contratto WPF sul salvataggio locale e non alterare i dialog di conferma.

- [x] **Step 2: Eseguire il test mirato e verificare il fallimento**

  Run: `node --test tests/ui-contract.test.mjs`

  Expected: FAIL perché il dialog contiene oggi solo la guida rapida e non ha `help-list`.

- [x] **Step 3: Implementare la struttura della guida**

  In `index.html`, creare sezioni brevi per:

  - Navigazione tra Panoramica, Il mio lavoro, Persone, Report e progetti.
  - Creazione/modifica/spostamento delle attività e gestione di persone, priorità, tag e scadenze.
  - Filtri, ricerca globale e viste Bacheca, Elenco, Settimana.
  - Report portfolio/progetto, note finali e apertura in Excel/LibreOffice.
  - Stati vuoti, errori di salvataggio, recupero e annullamento.
  - Tabella shortcut con `Ctrl/Cmd+K`, `Ctrl/Cmd+N`, `Ctrl/Cmd+S`, `Ctrl/Cmd+1..4`, `Ctrl/Cmd+Shift+B/L/W`, `F1`/`?` ed `Esc`.

  Usare markup semantico (`section`, `h3`, `dl`/lista) senza aggiungere controlli che duplicano le azioni reali.

- [x] **Step 4: Dare alla guida una gerarchia visiva leggibile**

  Aggiornare `.help-modal` per una larghezza responsive più adatta alla guida, con `max-height` e scroll interno; aggiungere stili per `.help-section`, `.help-list`, `.shortcut-grid`/`.shortcut-key`, mantenendo contrasto e focus visibile. Alla dimensione minima il contenuto deve scorrere senza uscire dalla finestra.

- [x] **Step 5: Rieseguire i test e verificare focus/modal**

  Run: `node --test tests/ui-contract.test.mjs`

  Expected: PASS. Con Playwright, aprire `?`, verificare che il dialog sia aperto, che il focus sia confinato/usabile da tastiera, che `Esc` lo chiuda e che il focus torni al pulsante guida.

---

### Task 3: Centralizzare e ampliare le shortcut

**Files:**
- Modify: `src/app.mjs:350-372,1446-1533`.
- Modify: `src/index.html` solo se servono `aria-keyshortcuts` o hint visivi sui controlli esistenti.
- Test: `tests/ui-contract.test.mjs` e `tools/ui-smoke.mjs` se necessario per una verifica runtime.

**Interfaces:**
- Consumes: `showSection`, `projectView`, `openHelpDialog`, `openQuickCreateTask`, `hasOpenModal`, `exportInProgress` e i pulsanti vista calendario.
- Produces: routing tastiera coerente, protetto da input testuali, senza interferire con drawer/dialog/export.

- [x] **Step 1: Aggiungere test di contratto per le nuove combinazioni**

  Verificare nel corpo di `handleKeydown` e nei relativi helper:

  ```js
  assert.match(app, /function isTextEntryTarget\(/);
  assert.match(app, /Ctrl.*1|event\.key.*1/);
  assert.match(app, /Ctrl.*Shift.*b/i);
  assert.match(app, /Ctrl.*Shift.*l/i);
  assert.match(app, /Ctrl.*Shift.*w/i);
  assert.match(app, /event\.key === "\?"/);
  ```

  Verificare inoltre che i comandi non partano mentre il target è `input`, `textarea`, `select`, `summary` o `contenteditable`, salvo `Esc` e `Ctrl/Cmd+S` nell’editor attività.

- [x] **Step 2: Eseguire il test e confermare che il contratto non sia ancora soddisfatto**

  Run: `node --test tests/ui-contract.test.mjs`

  Expected: FAIL sulle nuove shortcut.

- [x] **Step 3: Aggiungere helper e routing**

  Implementare `isTextEntryTarget(target)` e piccoli helper per mostrare una sezione o impostare `projectView`, così `handleKeydown` non contiene una matrice duplicata di modifiche DOM. Gestire:

  - `Ctrl/Cmd+1`: Panoramica.
  - `Ctrl/Cmd+2`: Il mio lavoro.
  - `Ctrl/Cmd+3`: Persone.
  - `Ctrl/Cmd+4`: Report.
  - `Ctrl/Cmd+Shift+B`: Bacheca.
  - `Ctrl/Cmd+Shift+L`: Elenco.
  - `Ctrl/Cmd+Shift+W`: Settimana.
  - `F1` e `?`: guida.

  Le shortcut di vista devono richiedere `activeSection === "project"` oppure aprire il progetto selezionato prima di impostare la vista; non devono eseguire durante export, modali o editor aperti. Conservare `Ctrl/Cmd+K`, `Ctrl/Cmd+N`, `Ctrl/Cmd+S` ed `Esc` esistenti.

- [x] **Step 4: Aggiornare la guida con la stessa fonte di verità**

  Usare le stesse etichette e combinazioni definite nel codice, evitando che la guida pubblicizzi comandi diversi da quelli realmente gestiti.

- [x] **Step 5: Verificare comportamento runtime**

  Con Playwright seedare un workspace, esercitare almeno `Ctrl/Cmd+1..4`, le tre viste di progetto, `?`, `F1`, `Esc` e un campo testo. Expected: cambio vista/sezione corretto, dialog aperto/chiuso, nessun salto di sezione mentre si scrive.

---

### Task 4: Rendere il tema XLSX più contrastato e sofisticato

**Files:**
- Modify: `src/core/xlsx.mjs:70-105`.
- Test: `tests/xlsx.test.mjs`.

**Interfaces:**
- Consumes: stessi nomi di stile (`HeaderBlue`, `HeaderDark`, `Card`, `Todo`, `Doing`, `Done`, `Risk`, `Warning`, `Muted`) usati dai builder di workbook.
- Produces: `styles.xml` con palette stabile, colori semanticamente distinti, testo con contrasto elevato, bordi leggeri e allineamenti invariati.

- [x] **Step 1: Aggiungere test sul tema del workbook generato**

  Estendere il test XLSX con asserzioni sul file prodotto, non solo sul sorgente:

  ```js
  const bytes = await createXlsxWorkbook([{ name: "Theme", rows: [["Header"], ["Done"]], cellStyles: [["HeaderBlue"], ["Done"]] }]);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /FF1E40AF|FF4C3FCF/); // header indigo/navy
  assert.match(text, /FF047857|FF059669/); // done emerald
  assert.match(text, /FFB91C1C|FFDC2626/); // risk red
  assert.match(text, /<borders count="[2-9]/); // visual separation
  ```

  Aggiungere anche una verifica che il font dei principali header resti bianco.

- [x] **Step 2: Eseguire il test e osservare il fallimento sulla palette attuale**

  Run: `node --test tests/xlsx.test.mjs`

  Expected: FAIL perché oggi `styles.xml` contiene i riempimenti pastello precedenti e un solo bordo vuoto.

- [x] **Step 3: Definire token e stili XLSX**

  Aggiornare `stylesXml()` con:

  - navy Broject `#171A2F` per titoli/header scuri;
  - indigo profondo `#1E40AF` o primary coerente per header principali con font bianco;
  - superfici chiare fredde per sezioni/card, non lavanda pallida;
  - slate neutro per `Todo`, ambra leggibile per `Doing`/`Warning`, emerald per `Done`, rosso profondo per `Risk`;
  - font scuri sui fondi chiari e font bianchi solo sui fondi sufficientemente scuri;
  - bordi sottili a contrasto moderato per header, card e stati.

  Conservare i nomi pubblici degli stili, le larghezze, i freeze pane, merge e numeri. Non cambiare la semantica dei dati.

- [x] **Step 4: Eseguire test XLSX e controllare un workbook completo**

  Run: `node --test tests/xlsx.test.mjs`

  Expected: PASS. Generare un workbook portfolio e uno progetto, estrarre `xl/styles.xml` e confermare che header, stati e numeri siano ancora presenti e leggibili in Excel/LibreOffice.

---

### Task 5: Verifica integrata e handoff

**Files:**
- Modify: `tests/ui-contract.test.mjs` e `tests/xlsx.test.mjs` solo per contratti mancanti scoperti durante la verifica.
- Create/replace: screenshot temporanei in `/tmp` o `artifacts/` solo se utili alla consegna.
- Modify: `HANDOFF.md` con stato, test e rimanenze se la sessione termina prima dell’integrazione Windows.

**Interfaces:**
- Consumes: risultati dei Task 1–4.
- Produces: evidenza verificabile dell’audit di tutte le schermate e nessuna regressione sui flussi esistenti.

- [x] **Step 1: Eseguire l’intera suite Node**

  Run: `npm test`

  Expected: tutti i test PASS.

- [x] **Step 2: Eseguire UI smoke con server locale**

  Run: `BROJECT_PLAYWRIGHT_MODULE=/tmp/broject-playwright-shim.mjs BROJECT_BASE_URL=http://127.0.0.1:4174 BROJECT_CHROMIUM=/snap/bin/chromium npm run ui-smoke`

  Expected: smoke PASS con overview, dimensione minima, dialog conferma, focus e bridge già coperti.

- [x] **Step 3: Fare un audit manuale automatizzato di tutte le schermate**

  Con dati seed aprire Overview, progetto/Bacheca, Elenco, Settimana, Il mio lavoro, Persone, Report, Ricerca, Guida e Task drawer a 1440×900 e 1080×720. Controllare: niente clipping, focus visibile, pulsanti disabilitati coerenti, stati vuoti/errore/loading, contrasto e leggibilità.

- [x] **Step 4: Controllare il diff e documentare eventuali rimanenze reali**

  Run: `git diff --check` e `git diff --stat` dalla root che contiene il repository. Se resta una verifica Windows non eseguibile su Linux, annotare il comando preciso e il risultato invece di dichiarare una verifica non fatta.

- [x] **Step 5: Consegnare lo stato**

  Riassumere file modificati, difetti corretti, shortcut disponibili, tema Excel, test eseguiti e qualsiasi rimanenza concreta.
