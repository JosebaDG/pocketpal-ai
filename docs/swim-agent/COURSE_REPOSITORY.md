# Repositorio de cursos: primer corte de implementación

Fecha: 2026-09-30. Código nuevo, pendiente de CI e integración nativa.

## Alcance

CoachCourseRepository recibe un puerto CoachCourseStorage. Lee y valida el snapshot al consultar o modificar; devuelve éxito solo después de que write resuelva. No hay caché de fichas en memoria que pueda prometer un guardado fallido. Serializa operaciones de una misma instancia.

Cada snapshot está ligado a workspaceId y courseId. Importar sobre un curso existente se rechaza, incluso si sus datos están corruptos. No existe reimportación automática ni pérdida silenciosa por reset. El roster valida identidades únicas y un grupo activo por participante.

Hay observaciones individuales y grupales separadas. El traslado cambia únicamente el grupo activo y añade fecha, origen, destino y justificante. Ambas colecciones de notas previas quedan intactas. Consultar studentNotes por participantId recupera la historia individual completa, sin filtrar por el grupo actual. groupNotes conserva la historia de cada grupo. Los traslados anteriores no se reescriben.

Las notas individuales nuevas requieren inscripción en el grupo indicado. La fecha de una nota representa el momento de registro en este corte; todavía no modela atribución retrospectiva a sesiones antiguas. El justificante se conserva como texto; archivos adjuntos quedan pendientes.

## Límite de seguridad y persistencia

El repositorio NO es un Talent. Los métodos Confirmed solo deben llamarse desde código de aplicación confiable, después de una interfaz de confirmación explícita. El nombre del método no implementa esa interfaz ni demuestra que un usuario haya confirmado. No exponer estos métodos directamente al modelo.

No se incluye adaptador de producción: falta conectar almacenamiento local protegido/transaccional y definir migraciones, acceso, copias y retención. Tampoco hay importación DOCX directa, interfaz de curso, voz, borrado o reset en este commit. No usar con datos operativos de menores.

La cola protege una instancia, no dos repositorios simultáneos ni varios procesos. La integración deberá compartir una instancia por alcance o implementar control de revisión/transacciones en el adaptador. Una escritura parcialmente aplicada debe resolverse en el adaptador; el test de fallo utiliza un mock que rechaza antes de escribir.

Los tests usan almacenamiento ficticio. Recuperar datos con otra instancia comprueba el contrato de serialización/lectura, no que un teléfono conserve los datos tras cerrar la app. Esa evidencia requiere adaptador nativo y prueba física.

## Verificación

El workflow Coach Course Checks instala dependencias, ejecuta typecheck y la suite nueva. No sustituye el CI general, no desactiva reglas upstream y no afirma que ESLint/Prettier estén verdes. Los resultados deben revisarse antes de integrar.

## Siguiente integración

Implementar el adaptador sobre la infraestructura local de PocketPal; interfaz de confirmación y consultas acotadas; importación DOCX revisable; conexión de voz basada en la PR #786. Añadir tests de fechas/traslados, límites de tamaño, fallos nativos, migraciones y recuperación. Mantener voz como requisito del primer prototipo operativo.
