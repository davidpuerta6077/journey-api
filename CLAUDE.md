# journey-api — Reglas del proyecto

## Rutas y auditoría (logs)

- Toda ruta que muta datos lleva la cadena: `checkAuth, checkPermission(code), saveLog(code, { descripcion, entityId, detalle }), handler`. `code` debe ser el mismo `submodule_code` en `checkPermission` y `saveLog`.
- `descripcion` y `detalle` de `saveLog` son funciones **síncronas** (corren en `res.on('finish')`, no se pueden `await` ahí). Si se necesita nombre/correo/curso real y el body solo trae un id, resolver el lookup contra BD **antes** de responder (dentro del handler, con `await`) y guardarlo en `req._logAlgo`; la función de `descripcion`/`detalle` lo lee de ahí.
- `descripcion` siempre corta y general (nunca listar todos los ítems de una operación en bloque ahí). El detalle item-por-item (correo, nombre, curso, estado) va en `detalle` (columna `logs.detail`, JSONB) para el modal "Ver detalle" del front.
- Nunca dejar un id crudo (`role_id`, `courseid`, `module_id`, etc.) como único dato en un log — resolver el nombre real contra BD primero (`postgresql.getXById`).

## Acceso a datos

- SQL vive en `database/querysets.js` (funciones que devuelven `{ text, values }`). `database/postgresql.js` las envuelve en funciones que devuelven Promesas y las exporta. No meter SQL inline en `api/**/controller.js` ni `api/**/network.js`.
- Los controllers (`api/<modulo>/controller.js`, exportado como función) reciben `injectedDB` opcional que por defecto es `require('../../database/postgresql')` — mantener ese patrón de inyección para poder testear con mocks.
- Cambios de esquema van como script standalone en `database/seeds/*.js`: idempotente (`ADD COLUMN IF NOT EXISTS`, etc.), con su propio `Pool` y `main()`, ejecutable con `node database/seeds/archivo.js`. Nunca alterar tablas a mano ni meter DDL en el código de la app.

## Integraciones externas

- Toda llamada a Moodle pasa por `services/moodleService.js:moodleRequest()`. Nunca axios directo a la URL de Moodle desde otro archivo.
- Normalización de texto (Title Case, limpieza de nombres/asignaturas) centralizada en `services/normalize.js` — no reimplementar normalización ad-hoc en otro módulo.

## Entorno local

- La BD real se alcanza vía túnel PuTTY en `127.0.0.1:5434`. Si `/auth/permissions` falla, el front manda a "no autorizado", o cualquier endpoint que toque BD tira error raro: revisar primero `netstat -ano | findstr ":5434"` (debe estar LISTENING) antes de sospechar del código.
- `npm run dev` usa nodemon — si los cambios no parecen tomar efecto, puede haber un proceso zombie en el puerto 3001 sirviendo código viejo (`netstat -ano | findstr ":3001"` y matar el PID viejo si nodemon no se reinició solo).
