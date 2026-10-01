# Modelo de dominio: sesiones, notas y repaso

2026-10-01. Requisitos aportados por el entrenador; lógica con tests sintéticos, sin verificar en dispositivo.

## Calendario

Una sesión es un grupo en una fecha concreta. Su duración depende del nivel del grupo: Familiarización 30 minutos, Adaptación 35, Perfeccionamiento 45. El nivel se asigna una vez por grupo mediante setGroupLevelConfirmed; un grupo sin nivel se reporta como pendiente, no se adivina. Lunes y martes hay bloques de dos sesiones seguidas; miércoles y jueves, de tres. Un bloque se detecta por proximidad: sesiones separadas por 15 minutos o menos pertenecen al mismo bloque (DEFAULT_MAX_GAP_MINUTES, ajustable). La hora es la local del dispositivo; clockFrom la lee y es quien la aporta, no el modelo.

## Notas

Las notas se escriben normalmente al final de un bloque, con excepciones entre clases. Por eso cada nota puede llevar sessionDate (YYYY-MM-DD): la clase a la que se refiere, distinta del momento en que se escribe. Se valida que la fecha caiga en el día de la semana del grupo cuando el día es reconocible. Las notas del alumno le siguen entre grupos; las de grupo permanecen donde se escribieron. Al trasladar se añaden eventos left y joined a los grupos, enlazados al traslado, sin modificar nada anterior.

## Asistente por hora

noteTargets decide qué ofrecer: en clase, ese grupo primero; entre clases cercanas, la que acaba de terminar; al terminar un bloque, todo el bloque con aviso de los grupos sin nota (missing); antes de empezar, todo como alternativa. Siempre se ofrecen también los demás grupos del día. El agente propone y la persona confirma; una grabación que cubra varios grupos deberá repartirse con revisión humana, nunca de forma automática.

## Repaso

flagForReviewConfirmed marca una nota para repasar con un motivo opcional; resolveReviewConfirmed la resuelve. Son eventos añadidos, no se borra historia. pendingReviews devuelve lo pendiente.

## Pendiente

Borrado y reinicio de curso o espacio (requiere ampliar el puerto de almacenamiento), notas retroactivas de alumnos ya trasladados, grupos en paralelo a la misma hora, conexión con el Talent y la interfaz, y verificación en dispositivo.
