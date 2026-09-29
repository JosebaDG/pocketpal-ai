# Beta en tu iPhone: ruta honesta y reproducible

## Estado actual

Esta rama incluye un Talent `coach_workspace` con demostración sintética y un importador JSON mediante el selector de archivos que PocketPal ya usa. El fichero se valida en el dispositivo y el listado queda **solo en memoria de la instancia del Talent**. No existe aún base de datos de cursillos, evaluación histórica, botón propio de grabación ni importación directa de DOCX. Un chat con nombres puede quedar en el historial local de PocketPal. Antes de usar datos de menores, valida medidas y autorización con la instalación. No pegues el DOCX con teléfonos en el chat.

## Primer arranque: exclusivamente sintético

1. Necesitas acceso a macOS con Xcode para la ruta oficial de compilación iOS. GitHub almacena el código, pero no instala un fork en el iPhone. En un Mac, instala Node de `.nvmrc`, Yarn Classic, Ruby/Bundler y CocoaPods siguiendo el README original.
2. Clona `JosebaDG/pocketpal-ai`, cambia a `feature/swim-agent-mvp` y ejecuta `node scripts/enable-swim-agent.cjs`. Revisa `git diff`: debe añadir imports y registros a `src/services/talents/index.ts`; si el script se detiene, no modifiques el archivo a ciegas.
3. Ejecuta `yarn install --frozen-lockfile`, después `yarn lint && yarn typecheck && yarn test`. **No se han ejecutado aún en esta rama**: corrige cualquier fallo antes de seguir.
4. Sigue el procedimiento iOS del README upstream para CocoaPods y `yarn ios`/Xcode. En Xcode selecciona tu equipo de firma, un bundle ID único y tu iPhone físico. Apple permite probar en dispositivo con cuenta gratuita Personal Team, pero el perfil caduca a los 7 días y habrá que reinstalar; TestFlight requiere una membresía del programa. La compilación del fork es distinta de la app de App Store y sus archivos/modelos no se transfieren automáticamente.
5. En la app compilada descarga/carga un modelo local compatible con tool calling. Crea un Pal local con el prompt de `COACH_PAL.md` y activa **solo** `coach_workspace` para esta primera prueba. Verifica en pantalla una invocación real de herramienta, no únicamente una respuesta plausible del modelo.
6. Prueba la secuencia sintética: listar grupos → elegir `swim-demo` → buscar `Lía Ejemplo` → preparar nota → consultar `group_snapshot`. Debe responder `DRAFT_NOT_SAVED` y `NO_HISTORY_AVAILABLE`, no prometer registro ni evaluación.

## Preparar un listado sin subirlo a GitHub

La importación beta usa JSON versión 1, no DOCX. En tu ordenador, trabajando con tu archivo local (nunca en GitHub), instala `python-docx` y ejecuta `python scripts/docx_to_coach_roster.py TU_ARCHIVO.docx grupos.coach.json`. El conversor solo lee columnas **Código** y **Alumno** y encabezados; omite responsable, teléfonos, email y fecha de nacimiento. Reconoce las tablas de lista de espera, asociándolas al último grupo principal. Revisa localmente grupos, horarios, IDs y estados: si el Word cambió de estructura, no importes el resultado. No compartas aquí el JSON generado.

Cuando el responsable de la instalación autorice esta prueba, guarda el JSON en **En mi iPhone** dentro de Archivos, no en un proveedor en la nube. En la compilación propia, pide al Pal «importar listado local»; el Talent abrirá el selector del sistema. Selecciona el JSON. Debe devolver solo recuentos y `IMPORTED_IN_MEMORY_NOT_PERSISTED`; si falla, conserva el listado anterior. Vuelve a listar grupos y elige uno antes de buscar. Cerrar/reiniciar la app puede perder el listado importado. No uses esta beta como registro oficial de asistencias o progreso.

## Voz y mensajes: límites de esta beta

Para entrada de voz puedes probar el dictado del teclado de iOS en el campo de chat, verificando en el propio dispositivo si la configuración concreta funciona sin conexión. La reproducción TTS de PocketPal es una capacidad distinta: no transcribe audio. No existe todavía un botón nativo de grabación en este fork. Los mensajes son borradores: no hay Talent de envío ni datos de contacto importados.

## Si no hay Mac

No prometemos instalar desde GitHub directamente: para una compilación iOS hacen falta macOS/Xcode en un Mac propio o un servicio de compilación macOS y firma válida. El PC con RTX puede editar código y convertir el DOCX sin subir datos, pero no sustituye la firma ni la instalación iOS. Para varias personas de beta, estudiaremos TestFlight cuando exista una build probada y la cuenta adecuada.

## Puerta de salida de la beta sintética

Evidencia requerida: script aplicado, lint/typecheck/tests superados, build instalada, invocaciones reales de `coach_workspace`, cambio de grupo seguro, importación JSON sintética y confirmación de que no persiste ni envía. Solo entonces se decide una beta con datos operativos y un almacén protegido.
