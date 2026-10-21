# Aprender a personalizar PocketPal: caso Swim Agent

Esta guía explica **qué se ha construido, cómo repetirlo y qué falta**. No es una aplicación de producción ni contiene datos personales. Rama de trabajo: `feature/swim-agent-mvp`; el fork conserva la atribución e historial del proyecto original.

## 1. Mapa del proyecto

- `src/services/talents/SwimAgentEngine.ts`: dos motores que siguen `TalentEngine` (`execute` + `toToolDefinition`).
- `scripts/enable-swim-agent.cjs`: inserta las importaciones y el registro en `src/services/talents/index.ts`, sin sobrescribir manualmente todo el archivo. Se detiene si upstream cambia los puntos de inserción.
- `docs/swim-agent/README.md`: Pal y límites actuales.
- `src/services/talents/__tests__/SwimAgentEngine.test.ts`: casos sintéticos.

El modelo selecciona herramientas según sus esquemas; `AgentRunner` ejecuta el Talent registrado. Activar un nombre en un Pal **no instala código nuevo** en la app de App Store. La versión propia debe registrar los motores, compilarse e instalarse. Visión y TTS no son Talents del catálogo de cinco motores base.

## 2. Repetir la personalización

1. Haz fork del repositorio original, clónalo y crea una rama de funcionalidad. Conserva el repositorio original como `upstream`.
2. Examina `src/services/talents/types.ts`, `DatetimeEngine.ts`, `TalentRegistry.ts` e `index.ts`; identifica el contrato `TalentEngine`, el schema `ToolDefinition` y el punto `registerDefaultTalents`.
3. En esta rama, ejecuta `node scripts/enable-swim-agent.cjs` desde la raíz. **Revisa el diff**: solo debe añadirse una importación y dos líneas de registro a `index.ts`. Vuelve a ejecutarlo: debe indicar que ya está activado, sin duplicar nada.
4. Instala dependencias siguiendo el README oficial de la versión que hayas clonado. Ejecuta `yarn typecheck` y `yarn test`. Si fallan, no declares el cambio terminado: registra error y versión antes de ajustar código. Esta rama aún NO ha pasado esas pruebas ni una compilación iOS verificada.
5. Solo tras verificar lo anterior, compila y firma tu variante iOS según las instrucciones upstream. El dispositivo usa la app compilada; un commit en GitHub no cambia la app instalada.
6. Crea un Pal local y activa `swim_groups` y `swim_note_draft` en la versión compilada. Usa el prompt de `README.md`. Prueba exclusivamente con `Grupo de demostración A`, `Lía Demo` y `Teo Demo`.

## 3. Comportamiento verificable

- `swim_groups` sin ID lista grupos ficticios; con `demo-a` y un nombre devuelve coincidencias de ESE grupo sin teléfonos.
- `swim_note_draft` exige grupo, alumno, fecha y hecho observado; rechaza IDs de otro grupo y discos fuera de 0–3. Devuelve `DRAFT_NOT_SAVED` incluso cuando la propuesta es válida.
- No hay importador de Word, base local de alumnos reales, Talent de escritura, botón de confirmación ni dictado dentro de la app. No simules esas capacidades en una demostración.

## 4. Ejercicio para aprender

Añade un segundo grupo ficticio y un alumno ficticio. Escribe un test que compruebe que un alumno de `demo-a` no puede recibir una observación atribuida al grupo nuevo. Después sustituye el acceso sintético por una interfaz de repositorio local sin alterar los contratos de los dos Talents. El objetivo es aprender *inyección de dependencias* y validación de identidad, no importar contactos reales.

## 5. Privacidad y contribución

No incluyas listados, voces, números, correos, fotografías ni copias de seguridad de menores en commits, issues, logs o pruebas. Para datos operativos se necesitan almacenamiento protegido, importación en el dispositivo, control de accesos, copias y aprobación del responsable de la instalación. Publica solo funcionalidades generalizables y ejemplos sintéticos. Si un componente sirve a cualquier usuario de PocketPal, propón una PR separada a upstream; mantén la lógica de la escuela en el fork o paquete propio.

## 6. Bitácora de estado

- 2026-09-29: fork y rama creados; motores de lectura y borrador añadidos. Código remoto presente, integración mediante script aún pendiente de ejecución, pruebas y compilación sin verificar.
- Próximo hito comprobable: ejecutar script + tests, corregir fallos, integrar repositorio protegido e importador local. Ninguna promesa de disponibilidad en iPhone antes de instalar una compilación propia.
