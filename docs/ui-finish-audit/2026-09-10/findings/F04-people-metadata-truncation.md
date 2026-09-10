# F04 — Metadati troncati nelle schede Persone

**Severità:** P1 — informazioni operative non leggibili al minimo supportato.

## Evidenza

A `1080×720`, le schede mostrano `Designer - Stud…`, `Product manag…` e `Engineering lea…`. Il nome della persona è leggibile, ma ruolo e azienda — dati utili per assegnazioni e report — vengono troncati perché competono direttamente con l’azione **Modifica**. A `1440×900` la stessa griglia risulta leggibile.

- [Crop 1080 — schede Persone](../evidence/F04-people-metadata-truncation/1080x720-people-cards.png)
- [Crop 1440 — confronto](../evidence/F04-people-metadata-truncation/1440x900-people-cards.png)
- [Schermata completa 1080](../screens/1080x720/people.png)

## Piano di correzione

1. Dare priorità alla leggibilità dei metadati nella griglia minima: consentire wrapping controllato oppure passare a due colonne sotto la soglia utile.
2. Valutare un’azione Modifica più compatta o posizionata su una riga dedicata quando lo spazio scarseggia.
3. Mantenere ellissi solo per contenuti realmente secondari e fornire un titolo/tooltip completo se necessario.
4. Provare nomi, ruoli e aziende lunghi senza rompere progress bar e contatore.

## Criterio di accettazione

Con tre persone presenti a `1080×720`, ruolo e azienda devono essere leggibili o avere una soluzione di accesso esplicita; nessun testo primario deve essere perso per l’azione Modifica.
