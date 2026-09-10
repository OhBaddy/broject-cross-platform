# F02 — Scroll del calendario poco scopribile

**Severità:** P2 — comportamento previsto ma affordance debole.

## Evidenza

La specifica consente al calendario settimanale di scorrere orizzontalmente invece di comprimere sette colonne. A `1080×720`, però, l’apertura mostra solo parte di Sabato sul bordo destro e non c’è un’indicazione visiva chiara che esistano altre colonne. L’estremo destro contiene correttamente Domenica.

- [Crop 1080 — posizione iniziale](../evidence/F02-calendar-scroll-affordance/1080x720-calendar-left.png)
- [Crop 1080 — posizione finale](../evidence/F02-calendar-scroll-affordance/1080x720-calendar-right.png)
- [Crop 1440 — tutti i giorni visibili](../evidence/F02-calendar-scroll-affordance/1440x900-calendar-left.png)
- [Schermata completa 1080](../screens/1080x720/project-calendar-left.png)

## Piano di correzione

1. Mantenere l’overflow orizzontale e la larghezza minima delle colonne.
2. Aggiungere un affordance non invasivo: scrollbar/track visibile, ombra ai bordi o messaggio breve “scorri per vedere gli altri giorni”.
3. Verificare che mouse wheel/trackpad, tastiera e focus rendano raggiungibili primo e ultimo giorno.
4. Evitare di mostrare un giorno parzialmente senza un segnale che inviti a continuare.

## Criterio di accettazione

Alla dimensione minima l’utente deve capire dal primo frame che il calendario continua a destra; tutti i sette giorni devono essere raggiungibili senza comprimere il contenuto.
