# F03 — Altezze e densità di “Il mio lavoro”

**Severità:** P2 — gerarchia e densità non equilibrate.

## Evidenza

Le tre colonne di **Il mio lavoro** hanno `min-height: 260px`. Con uno o due elementi, la metà inferiore resta vuota; a `1080×720` i titoli sono inoltre ridotti a ellissi (`Definire il piano di…`, `Preparare il kit co…`) anche se c’è spazio verticale inutilizzato.

- [Crop 1080 — colonne](../evidence/F03-my-work-column-height/1080x720-columns.png)
- [Crop 1440 — confronto](../evidence/F03-my-work-column-height/1440x900-columns.png)
- [Schermata completa 1080](../screens/1080x720/my-work.png)

## Piano di correzione

1. Sostituire l’altezza fissa con una misura minima più contenuta e una crescita guidata dal contenuto.
2. Usare lo spazio recuperato per permettere ai titoli di andare su due righe controllate, oppure riequilibrare la larghezza delle colonne.
3. Mantenere altezza e allineamento coerenti quando una colonna è vuota, senza creare pannelli sproporzionati.
4. Verificare che l’accordion **Completate** resti separato e leggibile.

## Criterio di accettazione

Con i dati campione le card devono risultare compatte, i titoli devono conservare il significato principale e lo spazio vuoto non deve dominare la superficie.
