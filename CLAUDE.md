## Active Plugins

These plugins are installed globally and must be used in every session:

- **superpowers** — structured development methodology (brainstorm → plan → execute)
- **caveman** — ultra-compressed responses to cut token usage
- **claude-mem** — persistent memory across sessions
- **context-mode** — context window optimization (sandboxes tool output)
- **ui-ux-pro-max** — design intelligence: 50+ styles, 161 palettes, 99 UX guidelines, accessibility checklist

## claude-mem (Persistent Memory)

claude-mem captures everything done during sessions, compresses it with AI, and injects relevant context into future sessions automatically.

- At session start: claude-mem injects context from previous sessions — read it and orient accordingly before starting any work.
- At session end or on compaction: save a summary of what was done, decisions made, and files modified.
- Use `/mem` commands if available to query or update memory manually.
- Never discard injected context — it represents real prior work.

## context-mode (Context Window Optimization)

context-mode sandboxes tool outputs to prevent context bloat (98% reduction on raw tool output).

- Always prefer `ctx_execute`, `ctx_batch_execute`, and `ctx_fetch_and_index` over raw Bash/Read/WebFetch when dealing with large outputs.
- Use `ctx_search` to query indexed content instead of re-reading files already indexed.
- Use `ctx_index` to index large files or directories before working on them.
- Let context-mode hooks intercept Bash, Read, WebFetch, and Grep calls automatically — do not bypass them.

## superpowers (Development Methodology)

For any non-trivial feature or task, follow this pipeline:

1. `/superpowers:brainstorm` — explore the problem space before touching code
2. `/superpowers:write-plan` — get explicit sign-off on the approach
3. `/superpowers:execute-plan` — implement in batches with checkpoints
4. `/superpowers:code-review` — review before merging

Never skip to implementation without a plan on complex tasks.

## ui-ux-pro-max (Design Intelligence)

Invoke this skill whenever the task touches UI structure, visual design, or UX quality.

- **Must use**: designing new pages, creating/refactoring UI components, choosing colors/typography/layout, reviewing UI for accessibility or consistency, implementing navigation or animations.
- **Recommended**: when UI looks unprofessional but reason is unclear, pre-launch quality review, building design systems.
- **Skip**: pure backend, API/DB design, DevOps, non-visual scripts.

Always run the Pre-Delivery Checklist before delivering UI code (icons, interaction, layout, accessibility).

## caveman (Token Compression)

- Default mode is active. Keep responses compressed: no filler, no pleasantries, no narration of obvious steps.
- Use `/caveman ultra` for maximum compression on long sessions.
- Code blocks are always emitted verbatim regardless of mode — compression applies only to prose.

## General Behavior

- Read injected claude-mem context at the start of every session before asking clarifying questions.
- Trust context-mode to manage tool output size — do not manually truncate or summarize tool results that context-mode is already handling.
- On long sessions, periodically check `budget.remaining()` context budget and use `/caveman ultra` if nearing limits.

---

## Reglas de Trabajo

0. **Responder siempre en español** — Todas las respuestas, comentarios, explicaciones y preguntas deben ser en español, sin excepcion. Solo el codigo y los nombres tecnicos permanecen en ingles.

1. **No programar sin contexto** — ANTES de escribir codigo: lee los archivos relevantes, revisa git log, entiende la arquitectura. Si no tienes contexto suficiente, pregunta. No asumas.

2. **Respuestas cortas** — Responde en 1-3 oraciones. Sin preambulos, sin resumen final. No repitas lo que el usuario dijo. No expliques lo obvio. Codigo habla por si mismo: no narres cada linea que escribes.

3. **No reescribir archivos completos** — Usa Edit (reemplazo parcial), NUNCA Write para archivos existentes salvo que el cambio sea >80% del archivo. Cambia solo lo necesario. No "limpies" codigo alrededor del cambio.

4. **No releer archivos ya leidos** — Si ya leiste un archivo en esta conversacion, no lo vuelvas a leer salvo que haya cambiado. Toma notas mentales de lo importante en tu primera lectura.

5. **Validar antes de declarar hecho** — Despues de un cambio: compila, corre tests, o verifica que funciona. Nunca digas "listo" sin evidencia de que funciona.

6. **Cero charla aduladora** — No digas "Excelente pregunta", "Gran idea", "Perfecto", etc. No halagues al usuario. Ve directo al trabajo.

7. **Soluciones simples** — Implementa lo minimo que resuelve el problema. Nada mas. No agregues abstracciones, helpers, tipos, validaciones, ni features que no se pidieron. 3 lineas repetidas > 1 abstraccion prematura.

8. **No pelear con el usuario** — Si el usuario dice "hazlo asi", hazlo asi. No debatas salvo riesgo real de seguridad o perdida de datos. Si discrepas, menciona tu concern en 1 oracion y procede con lo que pidio.

9. **Leer solo lo necesario** — No leas archivos completos si solo necesitas una seccion. Usa offset y limit. Si sabes la ruta exacta, usa Read directo. No hagas Glob + Grep + Read cuando Read basta.

10. **No narrar el plan antes de ejecutar** — No digas "Voy a leer el archivo, luego modificar la funcion, luego compilar...". Solo hazlo. El usuario ve tus tool calls. No necesita un preview en texto.

11. **Paralelizar tool calls** — Si necesitas leer 3 archivos independientes, lee los 3 en un solo mensaje, no uno por uno. Menos roundtrips = menos tokens de contexto acumulado.

12. **No duplicar codigo en la respuesta** — Si ya editaste un archivo, no copies el resultado en tu respuesta. El usuario lo ve en el diff. Si creaste un archivo, no lo muestres entero en texto tambien.

13. **No usar Agent cuando Grep/Read basta** — Agent duplica todo el contexto en un subproceso. Solo usalo para busquedas amplias o tareas complejas. Para buscar una funcion o archivo especifico, usa Grep o Glob directo.

# journey-api — Reglas del proyecto

## Rutas y auditoría (logs)

- Toda ruta que muta datos lleva la cadena: `checkAuth, checkPermission(code), saveLog(code, { descripcion, entityId, detalle }), handler`. `code` debe ser el mismo `submodule_code` en `checkPermission` y `saveLog`.
- `descripcion` y `detalle` de `saveLog` son funciones **síncronas** (corren en `res.on('finish')`, no se pueden `await` ahí). Si se necesita nombre/correo/curso real y el body solo trae un id, resolver el lookup contra BD **antes** de responder (dentro del handler, con `await`) y guardarlo en `req._logAlgo`; la función de `descripcion`/`detalle` lo lee de ahí.
- `descripcion` siempre corta y general (nunca listar todos los ítems de una operación en bloque ahí). El detalle item-por-item (correo, nombre, curso, estado) va en `detalle` (columna `logs.detail`, JSONB) para el modal "Ver detalle" del front.
- Nunca dejar un id crudo (`role_id`, `courseid`, `module_id`, etc.) como único dato en un log — resolver el nombre real contra BD primero (`postgresql.getXById`).

- `/auth/permissions` toma el email del token verificado (`req.user.email`), nunca de query/body, y todo `await` va dentro del `try`: si falla debe responder un error (el front reintenta), no dejar la petición colgada ni devolver "sin permisos".

## Acceso a datos

- SQL vive en `database/querysets.js` (funciones que devuelven `{ text, values }`). `database/postgresql.js` las envuelve en funciones que devuelven Promesas y las exporta. No meter SQL inline en `api/**/controller.js` ni `api/**/network.js`.
- Los controllers (`api/<modulo>/controller.js`, exportado como función) reciben `injectedDB` opcional que por defecto es `require('../../database/postgresql')` — mantener ese patrón de inyección para poder testear con mocks.
- Cambios de esquema van como script standalone en `database/seeds/*.js`: idempotente (`ADD COLUMN IF NOT EXISTS`, etc.), con su propio `Pool` y `main()`, ejecutable con `node database/seeds/archivo.js`. Nunca alterar tablas a mano ni meter DDL en el código de la app.

## Integraciones externas

- **Toda matrícula y todo usuario llega a Moodle por BD externa, nunca por webservice.** Moodle lee las vistas `moodle_enrol` (plugin enrol_database) y `moodle_auth_users` (auth_db) por cron (ver `database/seeds/fixMoodleExternalDbViews.js`). "Sincronizar" en Nexo (`services/sync/syncStudents.js`, `syncEnrollments.js`) solo marca `sincronizado = true` en la BD para que la vista exponga el registro; no llama a Moodle para crear ni matricular.
  - Prohibido usar `core_user_create_users`, `enrol_manual_enrol_users` o `enrol_manual_unenrol_users` para crear usuarios o matricular/desmatricular: deja al estudiante con dos métodos de matrícula a la vez ("Manual" + "Base de datos externa").
  - Desmatricular = cambiar el estado académico en Nexo (la fila sale de `moodle_enrol` y Moodle aplica su acción de desmatrícula). Única excepción: la limpieza de matrículas heredadas al duplicar una semilla (`services/sync/duplicateSeedCourse.js`).
- Toda llamada a Moodle pasa por `services/moodleService.js:moodleRequest()`. Nunca axios directo a la URL de Moodle desde otro archivo.
- Única excepción a "no escribir en Moodle por webservice": desbloquear cuenta y reiniciar doble factor, vía el plugin propio `local_nexo` (código fuera de este repo, en `Dev/moodle-plugins/nexo`). Se llama solo desde `services/moodleAccount.js` con el token `MOODLE_NEXO_TOKEN` (servicio externo "Nexo"; si no está, `moodle_token`). No agregar otras escrituras a Moodle por ese camino.
- Normalización de texto (Title Case, limpieza de nombres/asignaturas) centralizada en `services/normalize.js` — no reimplementar normalización ad-hoc en otro módulo.

## Entorno local

- La BD real se alcanza vía túnel PuTTY en `127.0.0.1:5434`. Si `/auth/permissions` falla, el front muestra "No se pudieron cargar tus permisos" (Reintentar), o cualquier endpoint que toque BD tira error raro: revisar primero `netstat -ano | findstr ":5434"` (debe estar LISTENING) antes de sospechar del código.
- `npm run dev` usa nodemon — si los cambios no parecen tomar efecto, puede haber un proceso zombie en el puerto 3001 sirviendo código viejo (`netstat -ano | findstr ":3001"` y matar el PID viejo si nodemon no se reinició solo).

## Reportes (`services/reports/`)

- Un reporte nunca se queda en conteos: si devuelve cifras agregadas (por estado, rol, categoría...) debe devolver también `detalle: { titulo, columns, rows }` con las filas reales (qué cursos, qué estudiantes). La columna de agrupación se llama igual en `rows` y en `detalle.rows` para que el clic en el gráfico filtre el detalle.
- Cursos/usuarios de Moodle llevan enlace: columna con `link: '<clave_url>'` y la URL armada con `moodleCourseUrl`/`moodleUserUrl` de `services/reports/util.js`.
