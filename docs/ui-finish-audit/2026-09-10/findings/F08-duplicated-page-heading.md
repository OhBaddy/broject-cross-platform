# F08 — Ripetizione della gerarchia di pagina

**Severità:** P3 — decisione estetica, non blocca l’uso.

## Evidenza

Nelle viste Panoramica, Persone, Report e progetto il topbar mostra già il titolo della vista con sottotitolo; subito sotto il contenuto ripete lo stesso titolo, spesso con un secondo sottotitolo. Il pattern è coerente tecnicamente ma produce una gerarchia ridondante e consuma spazio verticale, soprattutto a `1080×720`.

- [Panoramica 1080](../screens/1080x720/overview.png)
- [Persone 1080](../screens/1080x720/people.png)
- [Report 1080](../screens/1080x720/reports.png)
- [Progetto 1080](../screens/1080x720/project-board.png)

## Piano di correzione

1. Decidere quale livello deve essere titolo di contesto: topbar come breadcrumb compatto oppure heading principale nel contenuto.
2. Se il topbar resta, ridurre il suo contenuto a contesto/navigazione; se resta il doppio titolo, differenziare chiaramente ruolo e scala.
3. Verificare che la decisione non tolga il contesto del progetto e non peggiori navigazione o accessibilità.

## Criterio di accettazione

Ogni vista deve avere una gerarchia leggibile in un solo colpo d’occhio, con un titolo primario e un solo sottotitolo utile per livello.
