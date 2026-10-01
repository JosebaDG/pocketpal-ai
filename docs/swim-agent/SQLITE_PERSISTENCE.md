# Persistencia SQLite: integración inicial

2026-09-30. Pendiente de resultado de CI y validación nativa.

Se añade coach_courses a la base pocketpalai existente; no se crea un segundo adaptador SQLite ni se usa el historial de chat como ficha. Esquema y migración 8→9 comparten coachCourseDefinition. Las migraciones 2 a 8 y las tablas anteriores se conservan. openLocalCoachCourseRepository carga de forma diferida el singleton existente y conecta CoachCourseRepository con WatermelonCoachCourseStorage. Falta invocarlo desde la interfaz/Talents: este commit no entrega una pantalla operativa.

Cada curso ocupa una fila con workspace_id, course_id, revision, snapshot, created_at y updated_at. El snapshot JSON es una fase inicial, no el esquema normalizado final. El repositorio valida todo el contenido; el adaptador valida cabecera, tamaño y coherencia de metadatos. El puerto solo admite llamadas de código confiable, nunca contenido del modelo directamente.

Las lecturas usan database.read. Dentro de database.write se consulta el alcance y se exige que la revisión actual sea la anterior a la entrante. Crear exige revisión cero y ausencia de registro. Un conflicto se propaga; no se reintenta silenciosamente. Se prepara una operación y se espera database.batch antes de devolver éxito, siguiendo los patrones de las PR oficiales #621 y #916. Se requiere un único Database compartido; no se garantiza coordinación con otros procesos o conexiones. No hay una restricción UNIQUE compuesta en este corte: se rechazan duplicados encontrados y se serializan comprobación/creación dentro del escritor compartido.

No se alteran las reglas de historiales: notas individuales vinculadas al alumno, grupales al grupo y traslado como evento con justificante.

Los tests de adaptador usan una base ficticia con operaciones preparadas. No prueban SQLite nativo ni rollback/cache tras un fallo real. La prueba de esquema comprueba declaración y migración, no ejecuta una actualización física. Antes de una beta: probar instalación nueva, migración desde versión 8 conservando chats/Pals/ajustes, cierre/reapertura, fallos de disco y memoria, y lecturas después de una escritura fallida. No afirmar recuperación nativa por el éxito de mocks.

Esta capa no añade cifrado, autenticación ni exclusiones de backup para cursos. No autoriza datos de menores. Revisar protección del archivo, copias, acceso, retención y logs antes de datos operativos. No conectar coach_courses a SyncService/PalsHub ni exportaciones de chats.

La PR comunitaria #916 también propone versión 9 para carpetas. Antes de adoptar esa rama hay que reconciliar migraciones. No reutilizar una versión ya instalada con un contenido distinto ni bajar el esquema para resolver conflictos.

Fuentes: [escritores](https://watermelondb.dev/docs/Writers), [migraciones](https://watermelondb.dev/docs/Advanced/Migrations), [PR #621](https://github.com/a-ghorbani/pocketpal-ai/pull/621), [PR #916](https://github.com/a-ghorbani/pocketpal-ai/pull/916).
