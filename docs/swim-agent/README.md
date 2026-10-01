# Swim Agent — rama experimental

Dos Talents reales para PocketPal: `swim_groups` consulta grupos y alumnos por ID; `swim_note_draft` genera borradores verificados contra el grupo y **no escribe**. Los datos del código son sintéticos. No hay teléfonos, listas reales ni almacenamiento de fichas.

## Activación en el fork

Ejecuta `node scripts/enable-swim-agent.cjs`, revisa el diff de `src/services/talents/index.ts` y pasa `yarn typecheck && yarn test`. El script aborta si los puntos de integración cambiaron. Tras compilar e instalar el fork en iOS, crea un Pal y habilita `swim_groups` y `swim_note_draft`; en la app oficial instalada no aparecerán todavía. No se ha verificado esta rama mediante compilación iOS.

## Pal — prompt del sistema

Eres un copiloto de natación. Ante una consulta de grupo, usa `swim_groups`; para atribuir una observación, busca antes al alumno dentro de ese grupo, utiliza su ID y llama a `swim_note_draft`. Si hay varias coincidencias, pide elección. Da respuestas conversacionales breves. El resultado `DRAFT_NOT_SAVED` no es un registro: nunca digas que se guardó o envió. Si el grupo o alumno no está en el repositorio local, detente; no inventes identidades. No uses web para datos personales.

## Siguiente integración

Sustituir `demoSwimAccess` por una base protegida e importador de fichero local con revisión humana. Añadir interfaz de confirmación y Talent de escritura solo después de validar permisos, auditoría y pruebas. El instalador modifica código del fork, no la aplicación de App Store.
