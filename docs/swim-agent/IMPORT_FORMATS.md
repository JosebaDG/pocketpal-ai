# Importación: XLSX y DOCX como entradas del curso

2026-09-30. Actualización de requisito: el Word era una selección particular del listado Excel original. XLSX es una entrada principal junto a DOCX. Esto sustituye las propuestas anteriores que exigían DOCX como única entrada. No se promete XLS antiguo, XLSM, documentos cifrados ni soporte universal de cuadrantes.

## Implementado en este corte

CoachTableImport prepara cursos a partir de tablas extraídas. El usuario elige hojas/tablas, rangos de filas, columnas de código y nombre, grupo y estado inscrito/espera. Se pueden mapear varios rangos de una misma hoja para grupos o listas de espera distintos. Índices de selección son relativos a la tabla decodificada y empiezan en cero; los errores conservan el número de fila original. Encabezados se excluyen mediante selección explícita, no por heurística.

No se deduplican personas automáticamente ni se mezclan homónimos. El mismo código en grupos distintos bloquea la importación; también duplicados en un grupo, rangos solapados, filas parciales y campos requeridos con fórmulas o números. Códigos numéricos necesitan una conversión revisada futura: no adivinar ceros iniciales. Las columnas no elegidas, incluidos contactos, no entran al roster persistente. Un error impide guardar todo el lote.

CoachTableImportSession conserva una copia serializada del candidato. Preparar no escribe. confirmReviewed persiste ese candidato mediante createConfirmed y rechaza cursos ya existentes; solo debe invocarse desde una interfaz de revisión humana. No es una verificación humana por sí mismo, ni debe exponerse al modelo. Cancelar invalida el candidato. No hay reimportación ni traslado implícito.

SheetJsRosterDecoder recibe bytes locales y un lector inyectado compatible con el API read de SheetJS. Enumera todas las hojas, conserva coordenadas y distingue texto, números y fórmulas sin recalcularlas. No se elige automáticamente la primera hoja. Los bytes tienen límite de 10 MiB; tras decodificar se limitan hojas, rangos, celdas y textos. Estos límites NO garantizan protección ante ZIP bombs o agotamiento durante el parseo: falta presupuesto de descompresión/tiempo y prueba nativa. No autorizar documentos no confiables sin esa revisión.

## Pendiente antes de una importación real

Integrar una versión fijada del lector XLSX con licencia/integridad revisadas y package.json/yarn.lock concordantes; añadir lector DOCX local de párrafos/tablas; reutilizar el selector de archivos de PocketPal; construir revisión/mapeo en pantalla; limpiar copias temporales; probar archivos reales sintéticos y formatos distintos en iOS/Android. Celdas combinadas no se rellenan automáticamente. Hojas ocultas deben identificarse en la futura interfaz. Si el formato requiere campos de grupo por fila, habrá que ampliar el mapeo o dividir rangos explícitamente.

No se ha instalado SheetJS ni se ha añadido un import directo al paquete ausente. Este commit no habilita elegir un XLSX/DOCX desde la app y no valida descompresión real: el test del puente inyecta un lector ficticio. El planificador DOCX recibe tablas ya extraídas, no bytes Word. No hay cambios en dependencias nativas ni en main.

Fuente candidata: [SheetJS React Native](https://docs.sheetjs.com/docs/demos/mobile/reactnative/) documenta lectura local y versiones de muestra. [Data Import](https://docs.sheetjs.com/docs/solutions/input/) indica usar read con datos binarios en React Native, no readFile de Node. La versión 0.20.3 aparece en el ejemplo oficial consultado; no se declara automáticamente segura o última. No copiar permisos ni desactivar comprobaciones de compilación de una demo sin revisar su adecuación al fork.

Mantener las reglas del proyecto: grupo activo único; historia individual acompaña al alumno; historia grupal permanece en el grupo; traslado fechado con justificante; voz requisito del prototipo; almacenamiento protegido pendiente antes de datos de menores. No enviar el fichero completo al modelo ni a servicios externos.
