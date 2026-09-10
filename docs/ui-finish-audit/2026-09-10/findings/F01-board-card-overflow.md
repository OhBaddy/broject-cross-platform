# F01 — Overflow delle card nella Bacheca

**Severità:** P1 — perdita di informazione nella dimensione minima supportata.

## Evidenza

A `1080×720` la prima card della colonna **Da fare** supera la larghezza utile della colonna: la pillola `Urgente` resta parzialmente fuori dal bordo destro e parte delle azioni è nascosta o compressa. A `1440×900` il problema non emerge perché c’è più spazio.

- [Crop 1080 — colonna Da fare](../evidence/F01-board-card-overflow/1080x720-board-column.png)
- [Crop 1440 — confronto](../evidence/F01-board-card-overflow/1440x900-board-column.png)
- [Schermata completa 1080](../screens/1080x720/project-board.png)

Le misure registrate indicano per `.todo-column` `clientWidth ≈ 263px` e `scrollWidth ≈ 341px`; per `#todoList` `clientWidth ≈ 239px` e `scrollWidth ≈ 329px`. È overflow reale, non semplice scroll intenzionale.

## Probabile origine

La combinazione `.project-board` + `.task-stack` + righe flex interne non concede sempre `min-width: 0` ai contenuti comprimibili. La card mantiene quindi una larghezza minima dettata da badge, testo e azioni.

## Piano di correzione

1. Consentire il restringimento dei figli di grid/flex (`min-width: 0`) nei livelli della card.
2. Definire una zona azioni che possa comprimersi senza coprire priorità, scadenza o titolo.
3. Applicare ellissi o wrapping controllato solo ai testi secondari, mai alla pillola di stato/priorità.
4. Provare titoli, assegnatari e tag lunghi a `1080×720` e `1440×900`, mantenendo drag/drop e focus.

## Criterio di accettazione

Nessun elemento visibile della card deve oltrepassare la colonna a `1080×720`; `Urgente`, scadenza, frecce e `Apri` devono rimanere leggibili e cliccabili.
