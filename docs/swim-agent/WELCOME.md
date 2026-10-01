# Bienvenida: PocketPal Swim Agent

> Una exploración abierta para convertir PocketPal AI en un asistente local, extensible y verificable para el trabajo de entrenadores de natación.

Este directorio vive en el fork de PocketPal AI. No pretende sustituir al proyecto original: lo utiliza como plataforma de aprendizaje y extensión. La licencia MIT, los avisos de copyright y las guías de contribución del proyecto upstream siguen aplicando.

## Para qué existe este experimento

La pregunta que guía el trabajo es sencilla: ¿cómo puede un entrenador terminar una sesión, abrir el iPhone, expresar una observación en lenguaje natural y recibir una propuesta útil, verificable y local?

El objetivo final no es un chat genérico ni un modelo gigantesco. Es una **cabina de trabajo** que reduzca la carga administrativa sin desplazar el juicio profesional:

```text
Entrenador → contexto de sesión → modelo local → Talent determinista
                                      ↓
                             borrador revisable
                                      ↓
                         confirmación humana explícita
                                      ↓
                          registro local protegido
```

En esta rama solo está implementada la primera pieza demostrable: consulta sintética de grupos y generación de borradores que no se guardan.

## Qué encontrará cada visitante

| Perfil | Punto de partida | Qué podrá aprender aquí |
|---|---|---|
| Entrenador o investigador | [README del Swim Agent](README.md) | Qué problemas operativos se quieren resolver y qué límites no se cruzan |
| Desarrollador React Native / TypeScript | [Ruta formativa](LEARNING_PATH.md) | Cómo PocketPal conecta Pals, schemas de función, Talents y AgentRunner |
| Colaborador de PocketPal | `src/services/talents/SwimAgentEngine.ts` | Un ejemplo mínimo de extensión por composición e inyección de dependencias |
| Revisor de seguridad o privacidad | Esta página y la ruta formativa | Qué no debe entrar jamás en el repositorio y por qué un borrador no equivale a un registro |

## Estado de la rama

| Capacidad | Estado | Descripción exacta |
|---|---|---|
| Fork de PocketPal | Listo | Fork público de trabajo; la rama experimental no modifica `main` |
| Pal especializado | Diseñado | El prompt guía al modelo para consultar, proponer y no inventar persistencia |
| `swim_groups` | Implementado, no integrado en binario | Lista grupos sintéticos y busca alumnos solo dentro del grupo elegido |
| `swim_note_draft` | Implementado, no integrado en binario | Valida grupo, alumno, fecha y discos; devuelve `DRAFT_NOT_SAVED` |
| Tests sintéticos | Escrito, pendiente de ejecución local | Casos de aislamiento por grupo, borrador y validación de discos |
| Registro real, Word, dictado, cámara y mensajes | No implementado | No deben presentarse como capacidades actuales |
| Compilación iOS propia | Pendiente | Un commit no modifica la aplicación instalada desde App Store |

La palabra clave es **verificable**: código presente no significa función ejecutada; una prueba escrita no significa prueba superada; una rama no significa versión instalada.

## PocketPal: las piezas existentes

PocketPal AI es una aplicación React Native cuya lógica principal está en TypeScript, con capas nativas para iOS y Android y ejecución local de modelos. Para este experimento interesan especialmente estas piezas upstream:

- **Pal:** configuración de una personalidad, prompt, modelo predeterminado y Talents activados. Un Pal orienta al modelo; no crea capacidades nativas por sí solo.
- **Talent:** motor TypeScript que declara un schema de función mediante `toToolDefinition()` y ejecuta una acción mediante `execute()`. El registro central es `src/services/talents/index.ts`.
- **TalentRegistry:** catálogo interno de motores por nombre. El modelo solo puede llamar a un Talent registrado y activado para la sesión.
- **AgentRunner:** ciclo que interpreta las llamadas de herramienta del modelo y devuelve su resultado a la conversación.
- **Interfaz del Talent:** un Talent puede ser solo texto o tener una representación visual específica. El resultado HTML es un mecanismo de visualización, no una base de datos ni una autorización de escritura.

La aplicación base registra actualmente `render_html`, `calculate`, `datetime`, `web_search` y `read_url`. Este fork añade, mediante un script explícito, `swim_groups` y `swim_note_draft`. La activación se hace por código para que sea auditable y reproducible.

## Arquitectura del prototipo

```text
Pal de natación
  ├─ llama a swim_groups
  │    └─ SwimAccess.groups() / SwimAccess.students()
  └─ llama a swim_note_draft
       ├─ verifica grupo y alumno
       ├─ valida fecha y configuración de discos
       └─ devuelve DRAFT_NOT_SAVED

Todavía no existe:
  ├─ acceso a la lista real
  ├─ importador de Word
  ├─ base de datos de fichas
  ├─ botón de confirmación
  ├─ Talent de escritura
  └─ dictado o cámara integrados
```

El diseño usa una interfaz `SwimAccess`. Eso permite sustituir el acceso sintético por un repositorio local protegido sin cambiar el contrato público de los Talents. Es una decisión didáctica: separa el razonamiento del modelo de la custodia de datos.

## Recorrido para desarrolladores

1. Lee `src/services/talents/types.ts`: ahí está el contrato `TalentEngine` y el formato OpenAI-style de `ToolDefinition`.
2. Compara `DatetimeEngine.ts` con `SwimAgentEngine.ts`: ambos implementan nombre, ejecución y schema.
3. Lee `TalentRegistry.ts` e `index.ts`: observa cómo los motores pasan a estar disponibles para los Pals.
4. Ejecuta `node scripts/enable-swim-agent.cjs` desde una copia local del fork. El script modifica solo los puntos esperados de `index.ts` y falla de manera segura si upstream los altera.
5. Revisa el diff, ejecuta `yarn typecheck` y `yarn test`. No continúes con una compilación si estas verificaciones fallan.
6. Compila una variante propia de la app siguiendo el README upstream y habilita los dos Talents en un Pal local.
7. Usa exclusivamente los datos ficticios incluidos.

## Recorrido para investigación

Este fork permite estudiar varias preguntas sin necesidad de convertirlas prematuramente en producto:

- ¿Qué nivel de modelo local basta para seleccionar herramientas y resumir una observación breve?
- ¿Cómo afecta el contexto, la cuantización y el KV cache a una interacción rápida en iPhone?
- ¿Qué validaciones deterministas reducen más los errores de atribución?
- ¿Qué interfaz de confirmación minimiza el esfuerzo del entrenador sin automatizar decisiones sensibles?
- ¿Qué capacidades deben vivir en TypeScript y cuáles requieren una integración nativa de iOS?

Los resultados deben documentar modelo, versión de app, parámetros, dispositivo, escenario sintético y resultado. No se documentan nombres, audios ni fichas reales.

## Límites de datos y seguridad

Este repositorio público no es un lugar para datos operativos. Nunca deben incluirse en commits, PRs, issues, registros de pruebas o capturas:

- Nombres reales, códigos de alumno, teléfonos, correos o responsables.
- Archivos Word/Excel operativos o copias de bases de datos.
- Audios, transcripciones, fotografías o vídeos de menores.
- Claves, tokens, credenciales o copias de seguridad.

Una futura versión operativa deberá importar localmente los datos, almacenar lo mínimo necesario y separar: **modelo que propone**, **herramienta que valida**, **persona que confirma** y **repositorio que persiste**.

## Cómo contribuir

- Cambios generalizables para PocketPal: prepara una PR pequeña y separada hacia el repositorio upstream.
- Capacidades de este caso de uso: trabaja en una rama, añade tests sintéticos y documenta qué está probado.
- Cambios de interfaz: acompaña la propuesta con una ruta clara de usuario y estados de error.
- Cambios que escriban datos: diseña primero confirmación explícita, auditoría y reversión.

## Próximos hitos

1. Ejecutar y corregir pruebas y typecheck del prototipo.
2. Integrar los Talents mediante el script y comprobar que aparecen en la edición de Pals de la compilación propia.
3. Sustituir el acceso sintético por un repositorio local protegido e importación revisable en el dispositivo.
4. Crear interfaz de sesión y confirmación humana.
5. Evaluar dictado local, visión y TTS solo cuando resuelvan una fricción real y con medidas reproducibles.

---

**Proyecto original:** [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai) · **Licencia:** MIT · **Esta rama:** experimento educativo y técnico; no es una aplicación de gestión de menores lista para producción.
