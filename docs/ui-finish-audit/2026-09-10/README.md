# Audit finiture UI — 10 settembre 2026

**Stato:** correzioni F01–F11 implementate e verificate.

Questo dossier raccoglie le imperfezioni visive osservate nella build dell’interfaccia desktop Broject, il piano approvato e la verifica post-correzione. Gli artefatti dell’audit e i runner di cattura restano separati dal comportamento dell’applicazione.

## Perimetro

- viewport verificati: `1440×900` e `1080×720`;
- dati rappresentativi: 2 progetti, 3 persone, 5 attività;
- viste: Panoramica, Bacheca, Elenco, Settimana, Il mio lavoro, Persone, Report, Ricerca;
- stati: vuoti, editor attività, dialoghi progetto/persona/note report, guida rapida;
- controlli: rettangoli, scroll container, overflow orizzontale/verticale, testo eccedente e screenshot crop.

La dimensione `1080×720` è il caso prioritario perché coincide con il minimo desktop supportato. Gli overflow dei contenitori `sr-only`, dei pannelli volutamente scrollabili e della pagina verticale non sono classificati come difetti visuali da soli.

## Lista dei finding

| ID | Severità | Area | Sintesi | Stato |
| --- | --- | --- | --- | --- |
| [F01](findings/F01-board-card-overflow.md) | P1 | Bacheca | La card della prima colonna esce dal contenitore a 1080 e la pillola di priorità viene tagliata. | Corretto e verificato |
| [F02](findings/F02-calendar-scroll-affordance.md) | P2 | Settimana | Lo scroll orizzontale previsto è poco scopribile e lascia una colonna parzialmente tagliata. | Corretto e verificato |
| [F03](findings/F03-my-work-column-height.md) | P2 | Il mio lavoro | Le tre colonne hanno vuoto verticale sproporzionato e le card strette troncano titoli utili. | Corretto e verificato |
| [F04](findings/F04-people-metadata-truncation.md) | P1 | Persone | Alla dimensione minima ruolo/azienda vengono troncati proprio accanto all’azione Modifica. | Corretto e verificato |
| [F05](findings/F05-report-card-whitespace.md) | P2 | Report | Le card export hanno altezza minima fissa e molto spazio bianco non funzionale. | Corretto e verificato |
| [F06](findings/F06-help-scroll-clipping.md) | P2 | Guida | All’apertura la sezione Scorciatoie è tagliata dal viewport interno e il fatto che resti contenuto sotto non è evidente. | Corretto e verificato |
| [F07](findings/F07-modal-min-height.md) | P2 | Dialoghi | Progetto, Persona e Note report usano min-height elevate che producono pannelli vuoti sotto le azioni. | Corretto e verificato |
| [F08](findings/F08-duplicated-page-heading.md) | P3 | Gerarchia globale | Topbar e contenuto ripetono lo stesso titolo e sottotitolo, riducendo densità e gerarchia. | Applicato e verificato |
| [F09](findings/F09-status-line-corners.md) | P2 | Bacheca | La linea di stato a sinistra non segue bene gli angoli arrotondati della card. | Corretto e verificato |
| [F10](findings/F10-my-work-inner-gutter.md) | P1 | Il mio lavoro | Le task card sono a filo del contenitore e manca il gutter interno della colonna. | Corretto e verificato |
| [F11](findings/F11-long-project-name-scroll.md) | P1 | Sidebar / intestazione | Un nome progetto lungo forza uno scroll orizzontale nella lista progetti e può far crescere il topbar. | Corretto e verificato |

## Ordine eseguito dopo l’approvazione

1. F01 — elimina l’overflow reale e la perdita di informazione nella Bacheca.
2. F04 — rende leggibili le schede Persone al minimo Windows.
3. F02 — conserva lo scroll del calendario ma rende chiaro come raggiungere tutti i giorni.
4. F03, F05 e F07 — normalizza densità, altezze e spaziature delle superfici ripetute.
5. F06 — rifinisce la guida senza sacrificare tastiera e contenuto.
6. F09 e F10 — rifiniscono rispettivamente l’indicatore di stato e la griglia interna delle card.
7. F11 — elimina lo scroll orizzontale dei nomi lunghi mantenendo il nome completo recuperabile.
8. F08 — gerarchia topbar/contenuto resa intenzionale e verificata.

## Evidenze

- Baseline pre-correzione: `screens/1080x720/`, `screens/1440x900/` e `evidence/`.
- Risultati post-correzione: `after/screens/1080x720/`, `after/screens/1440x900/` e `after/evidence/`.
- Misure browser post-correzione: `after/screens/1080x720/metrics.json` e `after/screens/1440x900/metrics.json`.
- Caso Windows con nome lungo: `after/evidence/F11-long-project-name/`.
- Runner riproducibili: `tools/ui-finish-audit.mjs` e `tools/ui-finish-audit-evidence.mjs`.

## Risultato sintetico

- Bacheca: le colonne e le card non hanno più overflow orizzontale; badge, scadenza, frecce e Apri restano nella card.
- Settimana: a `1080×720` il messaggio “Scorri…” è visibile sopra la griglia e il fade segnala il bordo continuabile; a `1440×900` tutti i giorni restano visibili senza hint superfluo.
- Il mio lavoro: titoli su massimo due righe, colonne compatte e gutter interno coerente.
- Persone/Report/Dialoghi: metadati leggibili e superfici dimensionate dal contenuto.
- Guida: corpo scrollabile con scrollbar stabile e affordance dedicata, footer separato.
- Nomi progetto lunghi: ellissi nella sidebar, tooltip con nome completo, nessuno scroll orizzontale nella lista o nel documento; topbar compatto.

## Controlli senza finding aperto

- Il drawer attività resta entro i `560px` previsti e mantiene le azioni visibili alle due dimensioni.
- Elenco e Ricerca non mostrano overflow visuale anomalo nei dati campione.
- Gli stati vuoti osservati forniscono una spiegazione e una prossima azione.
- Il focus visibile è presente sui controlli campionati.
- A `1440×900` la settimana mostra tutti i sette giorni senza scroll.

## Gate di approvazione

Approvazione ricevuta: tutti gli ID F01–F11 sono stati eseguiti e verificati a `1080×720` e `1440×900`.
