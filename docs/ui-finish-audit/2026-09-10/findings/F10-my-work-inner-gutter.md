# F10 — Task card a filo della colonna in “Il mio lavoro”

**Severità:** P1 — spaziatura interna mancante in una superficie ripetuta.

## Cosa ho osservato

Nella vista **Il mio lavoro**, le task card sono inserite direttamente nel `.section-card` della colonna. Il titolo della colonna ha `padding-inline: 18px`, ma il `.card-list` non ha un gutter orizzontale equivalente. Di conseguenza le card arrivano fino al bordo interno della colonna, senza aria laterale: il loro bordo sembra coincidere con quello del pannello e la gerarchia “colonna → contenuto” si perde.

- [Crop 1080 — colonna e task card a filo](../evidence/F10-my-work-inner-gutter/1080x720-column.png)
- [Crop 1440 — confronto](../evidence/F10-my-work-inner-gutter/1440x900-column.png)
- [Schermata completa 1080](../screens/1080x720/my-work.png)

## Piano di correzione

1. Applicare al contenuto della colonna un gutter orizzontale coerente con quello dell’heading, idealmente tramite una regola condivisa per `.card-list` e stato vuoto.
2. Conservare il gap verticale tra le card e la distanza dal titolo.
3. Verificare che il gutter non introduca overflow a `1080×720` e non renda troppo strette le card.
4. Allineare anche lo stato vuoto alla stessa griglia interna, così card e messaggio non avranno due margini diversi.

## Criterio di accettazione

Ogni task card deve avere spazio visibile e simmetrico tra il proprio bordo e il bordo della colonna; il titolo, le card e lo stato vuoto devono condividere la stessa linea di allineamento.
