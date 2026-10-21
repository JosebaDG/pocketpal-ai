# Cambios del caso Swim Agent

## MVP 1: ciclo completo en pantalla y nota sin duplicados (21/10/2026)

- **Bug corregido: nota duplicada.** Confirmar dos veces la misma nota la guardaba dos veces. Ahora el id de la nota sale de su contenido (tipo, grupo, alumno, fecha de sesión y texto normalizado) y `CoachCourseRepository.confirmNoteDraft` devuelve la nota ya guardada sin escribir ni subir la revisión. `draft_note` devuelve ese mismo `draftId`. Pruebas: doble confirmación, dos toques simultáneos, espacios del dictado, reapertura y notas distintas que siguen separadas.
- **Pantalla «Coach (prueba)»** (`src/screens/CoachScreen`), en el menú lateral: cargar el curso ficticio o importar un JSON con vista previa → grupo → alumno inscrito → escribir o dictar con el teclado → revisar → guardar una sola vez → ver las notas del alumno. Recuerda el último curso al reabrir la app y lo marca como curso activo para el Talent `coach_course`.
- **Curso ficticio** (`src/features/coach/demoCourse.ts`): 4 grupos, 10 inscritos y 1 en espera, todos con nombres inventados.
- **Preparación iOS local** (`scripts/coach-ios-local-setup.sh`) y guía [INSTALAR-POR-CABLE.md](INSTALAR-POR-CABLE.md). Sin cambios en `ios/`, Podfile ni dependencias nativas.
- **Verificado en Linux:** suite Jest completa, ESLint sin errores y typecheck. **No verificado:** compilación iOS real, que se hace en el Mac.
- Fuera del MVP 1: TTS, Core AI, informes trimestrales, importación de Excel en pantalla y cifrado.

## CI diagnóstico del experimento

Se añade `.github/workflows/coach-workspace-checks.yml`. Es un flujo acotado al PR y a cambios del experimento: instala dependencias con Node de `.nvmrc`, ejecuta `yarn typecheck` y los tests Jest de CoachRoster, SwimAgentEngine y CoachWorkspaceEngine. No ejecuta ESLint porque el CI upstream falla actualmente antes de typecheck por errores preexistentes de lint en `src/utils/index.ts`. El éxito de este workflow no significa que el CI completo del upstream esté verde ni que exista una compilación iOS.

## Refactor: herramientas sin estado y selector inyectado

- **Estado compartido eliminado.** `coach_workspace` ya no guarda un grupo seleccionado: `groupId` es obligatorio en cada llamada con alcance de grupo. Motivo: el motor es único para toda la app; una selección persistente podía filtrarse entre conversaciones y atribuir una nota a la persona equivocada. `select_group` ahora solo valida y devuelve el grupo (`selectionStored: false`). Las guías anteriores que dicen «elegir grupo y después buscar» se entienden con esta semántica: el Pal recuerda el `groupId`, el motor no.
- **Acoplamiento roto.** El motor importaba `importUtils`, que importa `palStore`, mientras `PalStore` importa `registerDefaultTalents`: un ciclo talents → utils → store → PalStore → talents. Ahora el selector de archivos es una dependencia inyectada (`CoachFileAccess`), como `SearchAccess` en upstream, y su implementación por defecto carga los módulos de forma diferida.
- **Funciones puras** `findEnrolledParticipants` y `draftObservationFor` en `CoachRoster.ts`; `CoachRosterSession` se conserva como envoltorio.
- **Pruebas ficticias** nuevas para homónimos entre grupos, ausencia de selección remanente e importación con selector simulado.

## Estado de verificación

Pendiente de resultado: workflow diagnóstico, `yarn lint`, compilación iOS. La importación dinámica (`import()`) de los módulos diferidos debe confirmarse con typecheck y tests.
