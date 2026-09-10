# F06 — Guida rapida aperta con contenuto tagliato

**Severità:** P2 — contenuto disponibile ma presentato come se fosse troncato.

## Evidenza

All’apertura della guida, a entrambe le risoluzioni, la card **Scorciatoie** continua sotto il viewport interno del contenuto e viene interrotta dalla fascia delle azioni. Il secondo screenshot, portato manualmente in fondo, dimostra che il contenuto esiste; il problema è la scarsa discoverability dello scroll e il taglio nel primo frame.

- [Crop 1080 — apertura](../evidence/F06-help-scroll-clipping/1080x720-help-top.png)
- [Crop 1440 — apertura](../evidence/F06-help-scroll-clipping/1440x900-help-top.png)
- [Schermata completa 1080 — apertura](../screens/1080x720/help-top.png)
- [Schermata completa 1080 — fondo](../screens/1080x720/help-bottom.png)

## Piano di correzione

1. Aumentare lo spazio utile del corpo della guida oppure ridurre in modo misurato gap e padding, senza rendere il testo troppo piccolo.
2. Rendere percepibile il fatto che il corpo è scrollabile con scrollbar/track stabile, gradiente o affordance equivalente.
3. Tenere footer e pulsante **Chiudi** separati dal contenuto, senza sovrapporre il bordo a una card.
4. Ricontrollare apertura da tastiera, `Esc`, focus e movimento ridotto.

## Criterio di accettazione

Il primo frame deve mostrare un contenuto volutamente scrollabile, senza far sembrare accidentalmente tagliata una scorciatoia; tutte le sezioni devono restare raggiungibili.
