# Cambios del caso Swim Agent

## Refactor: herramientas sin estado y selector inyectado

- **Estado compartido eliminado.** `coach_workspace` ya no guarda un grupo seleccionado: `groupId` es obligatorio en cada llamada con alcance de grupo. Motivo: el motor es único para toda la app; una selección persistente podía filtrarse entre conversaciones y atribuir una nota a la persona equivocada. `select_group` ahora solo valida y devuelve el grupo (`selectionStored: false`). Las guías anteriores que dicen «elegir grupo y después buscar» se entienden con esta semántica: el Pal recuerda el `groupId`, el motor no.
- **Acoplamiento roto.** El motor importaba `importUtils`, que importa `palStore`, mientras `PalStore` importa `registerDefaultTalents`: un ciclo talents → utils → store → PalStore → talents. Ahora el selector de archivos es una dependencia inyectada (`CoachFileAccess`), como `SearchAccess` en upstream, y su implementación por defecto carga los módulos de forma diferida.
- **Funciones puras** `findEnrolledParticipants` y `draftObservationFor` en `CoachRoster.ts`; `CoachRosterSession` se conserva como envoltorio.
- **Pruebas ficticias** nuevas para homónimos entre grupos, ausencia de selección remanente e importación con selector simulado.

## Estado de verificación

Sin ejecutar: `yarn lint`, `yarn typecheck`, `yarn test`, compilación iOS. La importación dinámica (`import()`) de los módulos diferidos es una suposición sobre el entorno Metro/Jest de PocketPal que debe confirmarse con `typecheck` y `test`.
