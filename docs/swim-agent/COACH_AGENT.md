# Agente de curso: contrato del Talent coach_course

2026-10-01. Probado con un curso sintético en memoria; sin verificar en dispositivo ni con modelos reales.

## Qué es

coach_course da al modelo una vista de solo lectura del curso que la persona haya elegido en la app, más borradores. No guarda, no traslada, no borra y no cambia de curso: eso lo hace la interfaz tras una confirmación explícita. El curso activo lo fija código de confianza mediante coachActiveCourse.set; el modelo no tiene ninguna herramienta para cambiarlo. Todavía no existe la pantalla que lo fija, así que sin ella el Talent responde que no hay curso activo.

## Acciones

status: fase del día según el reloj del dispositivo, grupo en clase o que acaba de terminar, otros grupos de hoy, grupos ya terminados sin nota, grupos sin nivel y número de repasos pendientes. Son sugerencias. list_groups: todos los grupos con día, hora, nivel y recuento, para poder elegir cualquiera a mano. find_participants: búsqueda por nombre entre grupos o dentro de uno; avisa si hay varios y no los fusiona. student_history y group_history: historiales completos, últimas 30 notas. pending_reviews: apuntes marcados para repasar. draft_note: prepara una nota de alumno o de grupo. draft_review_flag: prepara la marca de repaso.

## Elección manual

Un borrador puede dirigirse a cualquier grupo, aunque no corresponda a la hora. El resultado indica matchesSuggestedGroup para que la pantalla lo muestre, sin bloquearlo. Si no se da sessionDate, se usa hoy cuando el grupo tiene clase hoy y, si no, la última clase de ese grupo. Si se da, debe caer en el día de la semana del grupo.

## Borradores

Todo borrador devuelve status DRAFT_NOT_SAVED y needsHumanConfirmation. Quien escribe es la pantalla, con appendStudentNoteConfirmed, appendGroupNoteConfirmed o flagForReviewConfirmed, mostrando alumno, grupo, fecha de clase y texto. Un alumno solo puede recibir una nota en el grupo donde está inscrito; los de lista de espera, no.

## Prompt del Pal

Eres un asistente para entrenadores de natación. Usa coach_course para saber qué grupo toca ahora: empieza con status al abrir una conversación. Ofrece primero el grupo en clase o el que acaba de terminar y menciona los grupos terminados sin nota. Si la persona quiere otro grupo, aunque no sea la hora, usa ese sin discutir: list_groups te da todos. Antes de atribuir una nota identifica grupo y alumno con find_participants; si hay varios, pide elegir. Prepara notas con draft_note y presenta alumno, grupo, fecha de clase y texto. Un borrador no es un registro: nunca digas que algo se ha guardado, trasladado, enviado o borrado. Pide siempre confirmar en la pantalla. Si no hay curso activo, pide elegir uno en la app. No inventes datos que las herramientas no devuelvan.

## Registro

node scripts/enable-coach-course.cjs añade una importación y un registro a src/services/talents/index.ts. Es idempotente y se detiene si PocketPal cambia esas líneas. Los Talents de demostración anteriores (coach_workspace, swim_groups y swim_note_draft) quedan obsoletos y no deben registrarse junto a este.

## Pendiente

Pantalla que fije el curso activo y confirme los borradores, nota de voz que cubra varios grupos con reparto revisado, selección de modelo con pruebas de uso de herramientas reales y verificación en iPhone.
