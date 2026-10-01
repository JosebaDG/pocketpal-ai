# Base de conocimiento: Coach Agent y comunidad PocketPal

Actualización documental: 2026-09-30. Investigación de referencia realizada en esta fecha. Los estados de PR y versiones son una fotografía temporal, no una garantía futura.

## Alcance y procedencia

La propuesta de Joseba de investigar los desarrollos comunitarios cambió el plan: antes de construir una capacidad desde cero, identificar código, pruebas y patrones reutilizables. Esta base conserva los descubrimientos y establece un procedimiento repetible de vigilancia técnica.

Este documento no acredita una compilación instalada ni incorpora código de terceros. Diferencia inspección de código, declaraciones del autor, propuestas propias y pruebas pendientes. No contiene datos operativos, nombres de alumnos, documentos Word ni audios.

Los requisitos de este documento sustituyen las propuestas anteriores incompatibles. Las guías existentes conservan valor histórico, pero el modo previo en la app oficial ha quedado descartado por el usuario.

## Decisiones del producto

- Construimos un sistema agéntico local sobre nuestro fork de PocketPal.
- El usuario ya validó la utilidad de los modelos locales. No repetiremos prototipos en la app instalada ni usaremos chats como sustituto del repositorio de cursos.
- No fijar Gemma ni ningún otro modelo en la lógica del curso. El entrenador elige entre modelos disponibles; cambiar el modelo no cambia los datos ni las validaciones.
- Las pruebas futuras evalúan nuestra integración, no repiten la validación exploratoria del usuario.
- Primera entrega aceptable: importar DOCX, revisar estructura, confirmar importación, buscar personas/grupos, introducir observaciones por texto y voz, confirmar guardado y recuperarlas tras reiniciar.
- Voz es requisito del primer prototipo operativo, no una ampliación opcional posterior.
- Espacios locales por entrenador y cursos separados; no denominarlos cuentas multiusuario seguras sin implementar y probar controles de acceso.
- Incorporar documentos distintos, reimportación revisable, borrado de curso, reset de espacio y reset global separado. No sustituir ni duplicar silenciosamente.
- No subir datos operativos a repositorios, issues, PR, logs o informes públicos. Lo local tampoco acredita por sí solo cifrado o ausencia de copias externas.

## Grupos, observaciones y traslados

Cada alumno pertenece a un único grupo activo dentro del curso. Puede trasladarse a otro; no puede tener pertenencias activas simultáneas.

Las observaciones individuales pertenecen al alumno y le acompañan al cambiar de grupo. Su historial debe seguir consultable en la ficha completa, sin reescribir contenido, fecha o procedencia.

Las observaciones grupales pertenecen al grupo y permanecen allí. El traslado de un alumno no mueve, borra ni modifica ninguna observación grupal existente.

El traslado añade un evento a la ficha del alumno con fecha, grupo de origen, grupo de destino y justificante. El formato del justificante deberá definirse: no presupone adjuntos ni datos médicos. Se pueden añadir eventos de salida/entrada a los grupos, sin alterar registros anteriores.

Dos nombres iguales no prueban identidad. Un documento con el mismo alumno en dos grupos exige resolver el conflicto antes de confirmar importación. Usar identidad estable y registro histórico de asignación, sin permitir dos asignaciones activas.

Modelo conceptual propuesto: espacio, curso, alumno, grupo, asignación histórica, sesión, observación individual, observación grupal, traslado y evento de auditoría. No está implementado por este documento.

## Estado de nuestro experimento

La investigación examinó código que importa JSON en memoria, consulta grupos y prepara borradores DRAFT_NOT_SAVED. No equivale a importación DOCX directa ni persistencia de fichas. El registro de Talents depende actualmente de un script; debe integrarse en el código que se compila.

El conversor DOCX existente supone encabezados con día y hora, primeras columnas de tablas y códigos no repetidos. Es una base para un formato específico, no un importador universal. El tratamiento de identidad y cambios de grupo necesita adaptación a las reglas anteriores.

No confundir tests de lógica con compilación nativa, instalación o funcionamiento comprobado en iPhone. No afirmar que estos estados sigan siendo actuales sin consultar el PR del fork.

## Plataforma y evolución oficial

Fuentes: [PocketPal oficial](https://github.com/a-ghorbani/pocketpal-ai) y [versiones](https://github.com/a-ghorbani/pocketpal-ai/releases).

La investigación registró v1.18.0, publicada el 25 de septiembre de 2026. Revalidar versión antes de fijar una base. El directorio de Talents examinado en main contenía CalculateEngine, DatetimeEngine, RenderHtmlEngine, WebSearchEngine y ReadUrlEngine. No se verificó allí un motor de gestión de cursos o importación DOCX.

PocketPal ofrece Pals, registros de motores y renderizadores, AgentRunner y persistencia conversacional con WatermelonDB. Un Pal configura capacidades disponibles; no instala código de un Talent ausente.

- [PR #705: PACT](https://github.com/a-ghorbani/pocketpal-ai/pull/705): antecedente del sistema de capacidades.
- [PR #709: turnos estructurados](https://github.com/a-ghorbani/pocketpal-ai/pull/709): declara sustituir la forma anterior de #705. No copiar una arquitectura antigua de mensajes de texto con una bolsa de metadatos como si fuera el diseño vigente.
- [PR #741: PalsHub y pact.talents](https://github.com/a-ghorbani/pocketpal-ai/pull/741): describe transferencia de referencias a Talents reconocidos y saludos; no instalación de motores nuevos.
- [PR #808: búsqueda web](https://github.com/a-ghorbani/pocketpal-ai/pull/808): antecedente de web_search y read_url, opt-in por Pal, claves propias y límites de resultados. No habilitar búsqueda de datos personales del alumnado.

## Candidato prioritario: voz

Fuente principal: [PR #786, Whisper push-to-talk](https://github.com/a-ghorbani/pocketpal-ai/pull/786).

Estado consultado: abierta, borrador, no fusionada y mergeable_state dirty. Head inspeccionado: 665a57711dccef39f8c8af125ace25230246b9ec. Tamaño: 49 archivos, 3013 líneas añadidas, 17 commits. Se examinó el diff.

Implementa MicButton, usePushToTalk, ASRStore, WhisperAsrEngine, permisos, captura PCM y tests. La transcripción se añade al texto existente y no se envía automáticamente. El reconocimiento está separado del modelo conversacional.

Ofrece Whisper base q5_1, small q8_0 y large-v3-turbo q5_0, con descarga independiente. La ruta de transcripción examinada usa el modelo local; la descarga inicial requiere red. Captura limitada a 30 segundos y filtro por energía/duración antes del decodificador.

El autor declara compilaciones Release iOS/Android y 3702 tests aprobados. También declara pendiente la verificación física de captura y transcripción. No se ejecutaron estas pruebas en nuestra investigación.

Decisión propuesta: candidato principal de reutilización para voz; no incorporar toda la rama sin revisión.

Comprobaciones pendientes derivadas de la lectura, no fallos reproducidos:
- Conflictos con nuestra base y compatibilidad de dependencias: la PR documenta llama.rn 0.12.4 y el README oficial consultado 0.13.0-rc.5.
- Ruido de piscina: superar el umbral de energía no demuestra que exista voz.
- Identificación y edición de nombres, castellano/euskera y frases breves.
- Capturas/transcripciones tardías tras cambiar de chat, curso, alumno o espacio; vincular la captura al destino original y poder cancelarla.
- Memoria conjunta de ASR y LLM, latencia, temperatura y liberación de recursos.
- Integridad del modelo: archivo y marcador de versión no equivalen a verificación por hash.
- Duración de 30 segundos y controles táctiles apropiados para el uso del entrenador.

## Confirmación de operaciones

Fuente: [PR #921, herramientas HTTP definidas por usuario](https://github.com/a-ghorbani/pocketpal-ai/pull/921).

Estado consultado: abierta, borrador, no fusionada y mergeable_state blocked. Head: a38d50252bd482a488de4f0591eab3de78c60de7. Cambio amplio: 65 archivos y 6720 líneas añadidas. Se examinaron estado y descripción, no se auditó íntegramente su diff.

Describe definiciones JSON, HttpToolEngine, confirmación en AgentRunner, cancelación, plazos por llamada, interfaz de revisión, importación/exportación, secretos en Keychain y tratamiento de respuestas como contenido no confiable. El autor declara 4604 tests aprobados; no es validación independiente nuestra.

Decisión propuesta: evaluar reutilización selectiva de confirmación y cancelación para guardar, importar, trasladar y borrar. No introducir HTTP, un servidor LAN o servicios externos como requisito del curso local. Una definición HTTP importable no instala un lector DOCX nativo ni código arbitrario.

## Persistencia, contexto e interfaz

- [PR #916, carpetas](https://github.com/a-ghorbani/pocketpal-ai/pull/916): abierta en la consulta. Describe migración WatermelonDB 8 a 9, operaciones agrupadas y borrado de carpeta conservando chats. Autor declara persistencia probada en simulador iOS; quedan plataformas/dispositivos pendientes. Reutilizar patrones, no equiparar carpeta conversacional con curso.
- [PR #927, compacción](https://github.com/a-ghorbani/pocketpal-ai/pull/927): abierta. Resume turnos antiguos para continuar conversaciones. Un resumen del modelo no sustituye observaciones ni registros del curso.
- [PR #622, búsqueda de mensajes](https://github.com/a-ghorbani/pocketpal-ai/pull/622): abierta. Referencia para búsqueda visual, no sustituto de consultas estructuradas por alumno/grupo.
- [PR #856, renderizador](https://github.com/a-ghorbani/pocketpal-ai/pull/856): abierta. Presentación rica y pruebas del parser; no proporciona persistencia del curso.
- [PR #737, WebView y fallos](https://github.com/a-ghorbani/pocketpal-ai/pull/737): antecedente de restricciones a JavaScript y errores de llamadas truncadas. Confirmaciones críticas en controles nativos, no HTML libre del modelo.

## Pals y variantes identificadas

[PalsHub](https://palshub.ai/pals) anunciaba 24 Pals. Se identificaron SketchPal, Cyberdeck Companion, Draven, Lingua, Southeast Lingo Translator y The Thought Path Coach. Son referencias de prompts, bienvenida y distribución; no se verificó un Pal de gestión deportiva con nuestros requisitos.

Corrección de una afirmación previa: PocketPal documenta instalación de Pals de PalsHub. Eso no contradice descartar la app actual: nuestro bloqueo es la falta de motores propios, no una personalidad conversacional.

- [CCSSNE/pocketpal-experimental](https://github.com/CCSSNE/pocketpal-experimental) y [PR #631](https://github.com/a-ghorbani/pocketpal-ai/pull/631): descripción de importación VLM, plantillas y depuración. Referencia experimental; no se auditó ni compiló todo el fork.
- [UntrustedGuy/pocketpal-ai-net](https://github.com/UntrustedGuy/pocketpal-ai-net): web_search añadido a inferencia local. Ejemplo de extensión; no prioridad del curso.
- [yzfly/pocketpal-ai-zh](https://github.com/yzfly/pocketpal-ai-zh): adaptación china y distribución Android; README consultado declaraba iOS en desarrollo. Referencia de localización, no solución de gestión.
- [PocketPal Dev Team](https://github.com/a-ghorbani/pocketpal-dev-team): agentes, plantillas, worktrees y revisión para desarrollar PocketPal. No son agentes operativos instalables en la app. Aprovechar método y documentación sin depender de toda la automatización.

Los resultados con nombres similares pero bases distintas se excluyen. No se inspeccionaron exhaustivamente los 918 forks registrados en la investigación.

## DOCX y recuperación documental

- [Issue #183, archivos en chat](https://github.com/a-ghorbani/pocketpal-ai/issues/183): petición de texto/PDF/documentos; no demuestra un importador de cursos terminado.
- [Issue #60, RAG](https://github.com/a-ghorbani/pocketpal-ai/issues/60) y [#91, colaboración RAG](https://github.com/a-ghorbani/pocketpal-ai/issues/91): cerradas en la consulta; cerrado no significa implementado o fusionado.

No se verificó una solución reutilizable completa DOCX a curso revisado y persistente. Priorizar importación estructurada local, mapeo revisable y búsquedas deterministas. RAG no es requisito para buscar identidades y grupos. Un formato desconocido debe pedir revisión, no crear silenciosamente una estructura inventada.

## Vigilancia comunitaria continua

Procedimiento propuesto, no monitorización automática activada:

1. Revisar releases, PR e issues antes de cada integración importante; considerar una revisión mensual y otra previa a compilar.
2. Buscar por capacidades: voz/ASR, documentos, persistencia/migraciones, herramientas/confirmación, seguridad y compatibilidad móvil.
3. Registrar fuente, fecha, autor, estado, head SHA, dependencias, licencia y alcance de la inspección.
4. Separar código leído, pruebas ejecutadas por nosotros, evidencia del autor y expectativas propias.
5. Distinguir abierto, borrador, cerrado sin fusión, fusionado y publicado; revalidar siempre.
6. Clasificar cada hallazgo: adoptar, adaptar, observar o descartar, justificando el beneficio y el coste.
7. Revisar licencia y conservar atribución antes de copiar código; no asumir una licencia común a todos los forks o dependencias.
8. Portar una pieza en una rama aislada con procedencia y pruebas. No trasladar todo un fork para resolver una necesidad pequeña.
9. Probar cambios nativos en dispositivo cuando corresponda; ni tests simulados ni CI garantizan captura de audio real.
10. Compartir posibles contribuciones genéricas con upstream mediante PR separadas, después de aprobación. Nunca publicar datos operativos.

No hay alertas, tareas programadas ni contribuciones externas creadas por este documento.

## Próximo hito técnico

Preparar portado selectivo de #786 y evaluación de confirmaciones de #921. En paralelo, implementar repositorio de cursos con observaciones individuales/grupales separadas y traslado documentado. Mantener la autonomía del teléfono.

Demostración de aceptación: dos documentos en espacios distintos; importar con revisión; dictar una nota y confirmarla; reiniciar y recuperarla; trasladar al alumno conservando su historia y sin alterar la grupal; cambiar de modelo sin cambiar datos; borrar un curso sin afectar al otro. Las ambigüedades de voz o identidad requieren revisión humana.

Documentación histórica relacionada: [README](README.md), [ruta de aprendizaje](LEARNING_PATH.md), [guía iPhone](IPHONE_BETA.md), [Pal](COACH_PAL.md) y [bitácora](CHANGELOG.md). Reconciliar sus límites y prioridades con esta base antes de presentarlos como instrucciones vigentes.
