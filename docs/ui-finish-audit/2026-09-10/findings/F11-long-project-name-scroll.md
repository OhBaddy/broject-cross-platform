# F11 — Nome progetto lungo: scrollbar orizzontale nella sidebar

**Severità:** P1 — artefatto visivo evidente e navigazione resa instabile con nomi realistici.

## Cosa ho osservato

Ho riprodotto il caso con il nome:

> Piano di rilascio commerciale e coordinamento operativo per Windows

Il problema nasce nella lista progetti della sidebar, non nel titolo principale: `.project-nav-list` ha circa `192px` disponibili ma arriva a `574px` di `scrollWidth`, con `overflow-x: auto`. Quando il progetto lungo viene selezionato, la lista può anche posizionarsi orizzontalmente a destra (`scrollLeft ≈ 382px`), mostrando solo la coda del nome. Questo produce la barra orizzontale e un risultato antiestetico.

Il titolo principale, invece, si dispone su due righe senza generare overflow della pagina; a `1080×720` è comunque opportuno mantenerlo controllato. Il topbar può anch’esso aumentare di altezza quando il contesto è molto lungo.

- [Schermata completa 1080 — progetto lungo](../evidence/F11-long-project-name/1080x720-long-project-board.png)
- [Crop 1080 — sidebar con scroll](../evidence/F11-long-project-name/1080x720-project-sidebar.png)
- [Crop 1080 — titolo principale](../evidence/F11-long-project-name/1080x720-project-heading.png)
- [Schermata completa 1440 — confronto](../evidence/F11-long-project-name/1440x900-long-project-board.png)
- [Crop 1440 — sidebar con scroll](../evidence/F11-long-project-name/1440x900-project-sidebar.png)
- [Misure 1080](../evidence/F11-long-project-name/1080x720-metrics.json)

## Probabile origine

`.project-nav-item` ha `width: 100%`, ma non ha `min-width: 0`; inoltre `.project-nav-name` è uno `span` inline. In questa combinazione la larghezza intrinseca del nome lungo vince sulla larghezza della sidebar, facendo crescere la riga della griglia e il suo scroll container.

## Soluzione proposta

1. Sidebar: rendere la riga realmente comprimibile (`min-width: 0`, `max-width: 100%`) e il nome un blocco ellissabile (`display: block`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`).
2. Sidebar: impedire lo scroll orizzontale accidentale (`overflow-x: hidden`) lasciando quello verticale per molti progetti.
3. Funzionalità: conservare il nome completo in un tooltip nativo/Windows-style e nell’etichetta accessibile, così l’ellissi non nasconde l’informazione senza alternativa.
4. Intestazione: mantenere il titolo principale su massimo due righe controllate; rendere il contesto del topbar compatto e troncabile, evitando che un nome lungo allarghi o faccia saltare l’altezza dell’header.
5. Verificare nomi con parole lunghe, caratteri accentati e nomi molto lunghi a `1080×720` e `1440×900`, inclusi selezione, hover, tastiera e ridimensionamento.

## Perché questa soluzione

L’ellissi nella sidebar è il compromesso più pulito per una lista stretta: mantiene righe uniformi, contatori e frecce allineati e elimina la scrollbar. Tooltip e nome accessibile preservano la consultazione completa. Il titolo principale resta invece più leggibile con wrapping controllato, perché lì c’è spazio per mostrare il contesto.

## Criterio di accettazione

Con il nome campione la sidebar resta larga `192px`, non mostra scrollbar orizzontale e mantiene dot, nome troncato, contatore e freccia allineati. Il nome completo è recuperabile con hover/accessibilità; il titolo principale non produce overflow né una crescita imprevista del layout.
