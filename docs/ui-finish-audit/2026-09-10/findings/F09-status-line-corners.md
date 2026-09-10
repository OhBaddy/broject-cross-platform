# F09 — Barra di stato non integrata con gli angoli della card

**Severità:** P2 — dettaglio grafico incoerente e percezione di sovrapposizione.

## Cosa ho osservato

La linea colorata a sinistra della card serve a comunicare lo stato dell’attività, ma oggi è uno `span` assoluto separato dal bordo della card:

```css
.task-status-bar {
  position: absolute;
  inset: 0 auto 0 0;
  width: 1px;
  border-radius: 9px 0 0 9px;
}
```

Il bordo della card ha raggio `9px`, mentre la linea viene posizionata a filo del contenitore e disegnata come un segmento rettangolare. Nei due angoli la curva della card e la linea non formano un unico dettaglio: la linea sembra appoggiata/sovrapposta al bordo e può arrivare troppo vicino agli estremi arrotondati. Il difetto è particolarmente evidente quando la card è stretta e l’overflow di F01 rende il bordo destro già problematico.

- [Crop 1080 — dettaglio card e angoli](../evidence/F09-status-line-corners/1080x720-task-card.png)
- [Crop 1440 — confronto](../evidence/F09-status-line-corners/1440x900-task-card.png)
- [Schermata completa 1080](../screens/1080x720/project-board.png)

## Piano di correzione

1. Scegliere una soluzione che faccia appartenere l’indicatore al perimetro della card: preferibilmente un bordo sinistro colorato della card oppure un pseudo-elemento con inset verticale e raggio coerente.
2. Eliminare la sovrapposizione della linea sul bordo neutro e allineare raggio, spessore e margine con la card.
3. Verificare i tre stati `Da fare`, `In corso`, `Completata`, compresi hover, drag e focus.
4. Ricontrollare insieme a F01 che l’indicatore non contribuisca a overflow o sottragga spazio ai contenuti.

## Criterio di accettazione

La linea deve seguire visivamente gli angoli della card, non sembrare un elemento appoggiato sopra il bordo e mantenere la stessa integrazione a `1080×720` e `1440×900`.
