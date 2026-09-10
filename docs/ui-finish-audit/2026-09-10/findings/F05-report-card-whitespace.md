# F05 — Spazio bianco sproporzionato nelle card Report

**Severità:** P2 — composizione poco densa e azioni non ottimizzate.

## Evidenza

Le card **Portfolio completo** e **Report progetto** hanno `min-height: 285px`, ma il loro contenuto termina molto prima. Il vuoto sotto i pulsanti domina la card, soprattutto a `1080×720`; la card informativa sotto usa invece un’altezza più contenuta.

- [Crop 1080 — card Report](../evidence/F05-report-card-whitespace/1080x720-report-cards.png)
- [Crop 1440 — confronto](../evidence/F05-report-card-whitespace/1440x900-report-cards.png)
- [Schermata completa 1080](../screens/1080x720/reports.png)

## Piano di correzione

1. Rendere l’altezza delle card guidata dal contenuto, mantenendo solo un minimo coerente con le altre superfici.
2. Allineare verticalmente descrizione, select e pulsante tra i due percorsi di export.
3. Conservare un’area d’azione prevedibile quando il progetto non esiste o il pulsante è disabilitato.
4. Verificare che il blocco “File completamente editabili” mantenga una separazione visiva proporzionata.

## Criterio di accettazione

Le due card devono apparire intenzionalmente bilanciate, senza un grande vuoto dopo l’azione, a entrambe le risoluzioni.
