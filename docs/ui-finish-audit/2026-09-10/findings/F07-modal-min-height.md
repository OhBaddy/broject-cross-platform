# F07 — Min-height eccessiva nei dialoghi

**Severità:** P2 — proporzione e ritmo incoerenti.

## Evidenza

Tre dialoghi hanno spazio bianco non funzionale sotto la barra azioni:

- **Nuovo progetto:** `min-height: 400px`, vuoto residuo visibile sotto i pulsanti;
- **Nuova persona:** `min-height: 470px`, vuoto molto ampio dopo il form;
- **Note del report:** `min-height: 420px`, grande area vuota dopo il pulsante di export.

- [Crop 1080 — progetto](../evidence/F07-modal-min-height/1080x720-project-dialog.png)
- [Crop 1080 — persona](../evidence/F07-modal-min-height/1080x720-person-dialog.png)
- [Crop 1080 — note report](../evidence/F07-modal-min-height/1080x720-report-notes-dialog.png)
- [Crop 1440 — progetto](../evidence/F07-modal-min-height/1440x900-project-dialog.png)
- [Crop 1440 — persona](../evidence/F07-modal-min-height/1440x900-person-dialog.png)
- [Crop 1440 — note report](../evidence/F07-modal-min-height/1440x900-report-notes-dialog.png)

## Piano di correzione

1. Rimuovere le min-height arbitrarie o sostituirle con una regola condivisa basata sul contenuto.
2. Mantenere padding, separatore e distanza azioni coerenti con la guida e il drawer.
3. Lasciare spazio sufficiente per errori di validazione senza ricreare un pannello vuoto in stato normale.
4. Ricontrollare focus iniziale, chiusura con `Esc`, viewport `1080×720` e testi più lunghi.

## Criterio di accettazione

In stato normale i dialoghi devono chiudere il proprio contenuto con un margine breve e intenzionale; nessuna grande area vuota deve restare sotto le azioni.
