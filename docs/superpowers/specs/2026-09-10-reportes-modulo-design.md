# Diseño — Módulo Reportes (Bravo Suite / Journey)

Fecha: 2026-09-10
Rama: `brand_branch`
Repos: `journey-api` (backend), `journey-front` (frontend)

## Objetivo

Vista de Reportes que permite **crear** definiciones de reporte y **visualizar**
su resultado. Las fuentes de datos son:

- **Moodle** (principal): vía acceso MySQL directo (`database/mysqlMoodle.js`).
- **Apps internas de Bravo Suite** (Journey y sus módulos): estructura preparada,
  sin reportes implementados en esta iteración.

Reportes objetivo del negocio (solo el primero se implementa ahora, el resto se
clona del patrón):

1. Conteo de cursos y estudiantes por categoría de Moodle (`moodle_courses_by_category`). **Implementado.**
2. Estudiantes en riesgo por inactividad (no entran al curso / plataforma hace
   mucho). Pendiente — se agrega como nuevo `tipo` + generador.

## Decisiones tomadas

- **Persistencia**: definiciones guardadas en BD (tabla `reports`). Sin snapshot
  de resultados — el resultado se calcula al vuelo en cada ejecución. Si más
  adelante se necesita comparar en el tiempo, se agrega snapshot como extensión.
- **Fuente Moodle**: MySQL directo (`mysqlMoodle`). Motivo: los conteos y el
  `lastaccess` se resuelven con una sola query agregada en el motor; vía REST
  serían decenas/cientos de llamadas al webservice y filtrado en Node.
- **Alcance de esta iteración**: scaffold completo (módulo API, servicios,
  endpoints, capa DB, vista front) + 1 reporte funcional como plantilla.

## Patrones del repo que se replican

- **Módulo API**: carpeta `api/<mod>/` con:
  - `controller.js` — factory `module.exports = (injectedDB) => { let data = injectedDB || require('../../database/postgresql'); ...; return { ... }; }`
  - `index.js` — `module.exports = require('./controller')(require('../../database/postgresql'))`
  - `network.js` — `express.Router()`, JSDoc de swagger, `checkAuth` + `checkPermission('<submodule_code>')` en toda ruta, `saveLog('<submodule_code>')` tras `checkPermission` en POST/PUT/DELETE, `response.success/error`, `next(error)`.
  - Alta en `api/index.js`: `const x = require('./x/network')` + `app.use('/x', x)`.
- **Servicios**: agrupados por carpeta (`services/preview/`, `services/sync/`),
  1 función exportada por archivo.
- **Acceso Moodle**: `services/moodleService.js` (`moodleRequest`, REST) o
  `database/mysqlMoodle.js` (pool `moodleDB` de `mysql2/promise`, `.query`).
- **Capa DB**:
  - `database/querysets.js` — builders puros `const selectX = (args) => ({ text: \`... ${schema}.tabla ...\`, values: [...] })`, exportados en el `module.exports` del final.
  - `database/postgresql.js` — wrappers que devuelven Promise envolviendo `pool.query(querysetFn(args), cb)`; imports arriba, exports abajo. Existe helper genérico `query(queryConfig)`.
  - `database/seeds/*.js` — scripts idempotentes autónomos (su propio `Pool`), uso `node database/seeds/<archivo>.js`.
- **Permisos / auditoría**:
  - `middleware/checkAuth.js` — valida token AWS Cognito, setea `req.user = { email, sub }`.
  - `middleware/checkPermissions.js` — `checkPermission(submoduleCode)`.
  - `middleware/saveLog.js` — `saveLog(submoduleCode)`; al `res` `finish` con 2xx y método mutante, inserta en `logs` (`email` del token, `entity_type` = submoduleCode, `description` = `\`${req.method} ${req.baseUrl}${req.path}\``).
  - El submódulo `reports` ya existe (movido al módulo `admin` por `database/seeds/moveIntegrationReportsToAdmin.js`). No hace falta seed de permisos.
- **Front**:
  - `src/services/<area>/<verbo><Noun>.js` — `import axios from 'axios'`, `import config from '../../config'`, `import awsAuth from '../AwsAuthService'`; `const BASE = config.api_domain.url_base`; token con `awsAuth.getToken()`; header `Authorization: \`Bearer ${token}\``; retorna `res.data?.body`; en catch `throw new Error(error.response?.data?.body || '<mensaje>', { cause: error })`.
  - Ruta `admin/reportes` + `PrivateRoute submoduleCode="reports"` ya en `src/App.jsx`. Entrada de sidenav ya en `src/components/sidenav/SideNavItems.jsx`. La vista actual es un stub `src/pages/main/Reportes/Reportes.jsx` que renderiza `<EnConstruccion titulo="Reportes" />`.
  - CSS por vista en `src/styles/main/<Area>/<Archivo>.css`.

## Arquitectura

### 1. Modelo de datos (Postgres, schema `test`)

Tabla nueva `reports`:

| columna | tipo | notas |
|---|---|---|
| id | serial PK | |
| nombre | text NOT NULL | |
| tipo | text NOT NULL | código del reporte, ej. `moodle_courses_by_category` |
| params | jsonb NOT NULL DEFAULT `'{}'::jsonb` | parámetros de la definición |
| descripcion | text NULL | |
| created_by | text NULL | email del token (mismo criterio que `logs.username`) |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| updated_at | timestamptz NOT NULL DEFAULT now() | |

Seed: `database/seeds/addReportsTable.js` — `CREATE TABLE IF NOT EXISTS ${schema}.reports (...)`. Idempotente. Patrón de `addCourseSyncStatusColumn.js` (Pool propio, `main().catch().finally(pool.end())`).

### 2. Capa de datos

**`database/querysets.js`** — sección nueva `// ─── REPORTS ───` antes del `module.exports`:

- `selectAllReports()` → `SELECT * FROM ${schema}.reports ORDER BY created_at DESC`
- `selectReportById(id)` → `... WHERE id = $1`
- `insertReportData({ nombre, tipo, params, descripcion, created_by })` → `INSERT ... RETURNING *` (`params` se pasa como objeto JS; `pg` lo serializa a jsonb con placeholder)
- `updateReportData(id, { nombre, params, descripcion })` → `UPDATE ... SET nombre=$1, params=$2, descripcion=$3, updated_at=now() WHERE id=$4 RETURNING *`
- `deleteReportData(id)` → `DELETE ... WHERE id=$1`

Agregar los 5 nombres al `module.exports` de `querysets.js`.

**`database/postgresql.js`** — imports nuevos desde `./querysets`, sección de funciones `// ─── REPORTS ───`, y nombres al `module.exports`:

- `listReports()` → `query(selectAllReports())`  *(o wrapper explícito con `pool.query`, según lo que quede más consistente con el archivo)*
- `findReportById(id)` → filas de `selectReportById(id)`
- `insertReport(data)` → `pool.query(insertReportData(data), cb)` → `result.rows`
- `updateReport(id, data)` → `pool.query(updateReportData(id, data), cb)` → `result.rows`
- `deleteReport(id)` → `pool.query(deleteReportData(id), cb)` → `result.rows`

**`database/mysqlMoodle.js`** — sin cambios.

### 3. Servicios — carpeta nueva `services/reports/`

- `runReport.js`
  - `async function runReport(tipo, params = {})`
  - `switch (tipo)` → invoca el generador correspondiente.
  - `default`: `const err = new Error(\`Tipo de reporte no soportado: ${tipo}\`); err.status = 400; throw err;`
  - Devuelve el **formato unificado** (ver abajo).
  - `module.exports = { runReport }`.
- `moodle/coursesByCategory.js`
  - `async function coursesByCategory({ categoryId = null, incluirSubcategorias = true } = {})`
  - Usa `const moodleDB = require('../../../database/mysqlMoodle')`.
  - Query agregada sobre `mdl_course_categories cc`:
    - `LEFT JOIN mdl_course c ON c.category = cc.id AND c.id <> 1` (excluye el site course)
    - conteo de estudiantes: `LEFT JOIN mdl_context ctx ON ctx.instanceid = c.id AND ctx.contextlevel = 50` → `LEFT JOIN mdl_role_assignments ra ON ra.contextid = ctx.id` → `LEFT JOIN mdl_role r ON r.id = ra.roleid AND r.shortname = 'student'`
    - `COUNT(DISTINCT c.id) AS cursos`, `COUNT(DISTINCT ra.userid) AS estudiantes`
    - `GROUP BY cc.id, cc.name, cc.path`
  - Filtro por `categoryId`:
    - exacto: `WHERE cc.id = ?`
    - con subcategorías: `WHERE cc.id = ? OR cc.path LIKE CONCAT((SELECT path FROM mdl_course_categories WHERE id = ?), '/%')`
  - Retorna filas `{ categoria, path, cursos, estudiantes }`.
  - `module.exports = { coursesByCategory }`.
- Carpetas preparadas para extender (se crean cuando se agregue el primer archivo):
  - `services/reports/moodle/` — más reportes Moodle (ej. `studentsAtRisk.js`).
  - `services/reports/internal/` — reportes de apps internas de Bravo Suite.

**Formato unificado** que devuelve todo generador y `runReport`:

```js
{
  columns: [ { key: 'categoria', label: 'Categoría' }, ... ],
  rows:    [ { categoria: '...', path: '...', cursos: 12, estudiantes: 340 }, ... ],
  meta:    { tipo, params, generatedAt: new Date().toISOString() }
}
```

La vista es genérica: pinta cualquier reporte a partir de `columns` + `rows`.

### 4. API — módulo nuevo `api/reports/`

**`controller.js`** — factory `(injectedDB) => { ... }`:

- `listReportes()` → `data.listReports()`
- `getReporte(id)` → `data.findReportById(id)`; si no existe → `err.status = 404`
- `createReporte(body, createdByEmail)` → valida `nombre` y `tipo` no vacíos (`err.status = 400`); `data.insertReport({ nombre, tipo, params: body.params || {}, descripcion: body.descripcion || null, created_by: createdByEmail })`; retorna `rows[0]`
- `updateReporte(id, body)` → `data.updateReport(id, { nombre, params, descripcion })`; retorna `rows[0]`
- `deleteReporte(id)` → `data.deleteReport(id)`
- `ejecutarReporte(id)` → `const def = await data.findReportById(id)`; si no → 404; `return runReport(def.tipo, def.params)`
- `ejecutarAdHoc(tipo, params)` → `return runReport(tipo, params)` (previsualizar sin guardar)
- `tiposDisponibles()` → catálogo **estático** en el controller:
  ```js
  [
    {
      tipo: 'moodle_courses_by_category',
      label: 'Cursos y estudiantes por categoría (Moodle)',
      fuente: 'moodle',
      params: [
        { key: 'categoryId', label: 'Categoría', type: 'number', required: false },
        { key: 'incluirSubcategorias', label: 'Incluir subcategorías', type: 'boolean', default: true }
      ]
    }
  ]
  ```
  El front usa esto para construir el formulario de params dinámicamente.
- `require('../../services/reports/runReport')` para `runReport`.

**`index.js`** — `module.exports = require('./controller')(require('../../database/postgresql'))`.

**`network.js`** — `express.Router()`, JSDoc swagger con tag `[Reports]`, `response`, `checkAuth`, `checkPermission`, `saveLog`:

| método | ruta | middleware | handler |
|---|---|---|---|
| GET | `/reports/tipos` | `checkAuth, checkPermission('reports')` | `ctrl.tiposDisponibles()` |
| GET | `/reports` | `checkAuth, checkPermission('reports')` | `ctrl.listReportes()` |
| GET | `/reports/:id` | `checkAuth, checkPermission('reports')` | `ctrl.getReporte(req.params.id)` |
| POST | `/reports` | `checkAuth, checkPermission('reports'), saveLog('reports')` | `ctrl.createReporte(req.body, req.user.email)` |
| PUT | `/reports/:id` | `checkAuth, checkPermission('reports'), saveLog('reports')` | `ctrl.updateReporte(req.params.id, req.body)` |
| DELETE | `/reports/:id` | `checkAuth, checkPermission('reports'), saveLog('reports')` | `ctrl.deleteReporte(req.params.id)` |
| GET | `/reports/:id/run` | `checkAuth, checkPermission('reports')` | `ctrl.ejecutarReporte(req.params.id)` |
| POST | `/reports/run` | `checkAuth, checkPermission('reports'), saveLog('reports')` | `ctrl.ejecutarAdHoc(req.body.tipo, req.body.params || {})` |

Nota de orden de rutas: registrar `/reports/tipos` y `/reports/run` **antes** de `/reports/:id` para que Express no matchee `tipos`/`run` como `:id`. (`/reports/:id/run` no colisiona.)

Cada handler: `try { const result = await ...; response.success(req, res, result, 200); } catch (error) { next(error); }`.

**`api/index.js`** — agregar junto a los demás:
```js
const reports = require('./reports/network');
...
app.use('/reports', reports);
```

### 5. Front

**`src/services/reportes/`** — un archivo por operación, patrón axios + `awsAuth` + `Bearer` + `res.data?.body`:

- `fetchReportes.js` → `GET ${BASE}/reports`
- `fetchTiposReporte.js` → `GET ${BASE}/reports/tipos`
- `createReporte.js` → `POST ${BASE}/reports`
- `updateReporte.js` → `PUT ${BASE}/reports/:id`
- `deleteReporte.js` → `DELETE ${BASE}/reports/:id`
- `runReporte.js` → `GET ${BASE}/reports/:id/run`
- `runReporteAdHoc.js` → `POST ${BASE}/reports/run` (body `{ tipo, params }`)

**`src/pages/main/Reportes/Reportes.jsx`** — reemplaza el stub `EnConstruccion`:

- Al montar: `fetchReportes()` + `fetchTiposReporte()`.
- Tabla de reportes guardados: columnas nombre, tipo (label), creado (`created_at`), acciones **Ejecutar** / **Editar** / **Eliminar**.
- Botón **Nuevo reporte** → panel/modal:
  - inputs `nombre`, `descripcion`
  - `select` de tipo (opciones de `/reports/tipos`)
  - campos de `params` renderizados dinámicamente según `params[]` del tipo elegido (number / boolean / text)
  - botón **Previsualizar** → `runReporteAdHoc({ tipo, params })` → muestra resultado sin guardar
  - botón **Guardar** → `createReporte(...)` → refresca lista
- **Ejecutar** (fila) → `runReporte(id)` → renderiza `<TablaResultado columns rows meta />`.
- `TablaResultado` — componente genérico en la misma carpeta (`src/pages/main/Reportes/TablaResultado.jsx`) que pinta `columns`/`rows` y muestra `meta.generatedAt`.
- Estados de carga y error con el mismo estilo que `SyncCursos` / `ModulosCursos` (loader, mensaje de error del `Error` lanzado por el service).

**`src/styles/main/Reportes/Reportes.css`** — estilos de la vista, siguiendo convención de los demás CSS de `src/styles/main/`.

**Sin cambios** en `src/App.jsx` ni `src/components/sidenav/SideNavItems.jsx` (ruta `admin/reportes`, `PrivateRoute submoduleCode="reports"` y entrada de menú ya existen).

### 6. Manejo de errores

- API: cada ruta hace `next(error)`; el middleware de errores de `api/index.js` responde `response.error(req, res, err.message, err.status || 500)`.
- Validación (`nombre`/`tipo` faltantes, `tipo` no soportado, reporte inexistente): el error lleva `err.status` (400 / 404) para que el middleware use ese código.
- Fallo de conexión a Moodle DB: el error de `moodleDB.query` sube sin `status` → 500 con su mensaje.
- Front: cada service lanza `new Error(error.response?.data?.body || '<mensaje por defecto>')`; la vista captura y muestra el mensaje.

### 7. Testing

No hay suite en el repo (`npm test` es `echo "Error: no test specified" && exit 1`). Verificación manual:

1. `node database/seeds/addReportsTable.js` → tabla creada.
2. Arrancar API (`npm run dev`).
3. Con token válido y permiso `reports`:
   - `GET /reports/tipos` → devuelve el catálogo.
   - `POST /reports` con `{ nombre, tipo: 'moodle_courses_by_category', params: {} }` → 200, fila creada.
   - `GET /reports/:id/run` → formato unificado con conteos reales de la BD Moodle local.
   - `POST /reports/run` con `{ tipo, params: { categoryId: <id real> } }` → resultado filtrado.
4. Front: entrar a `/admin/reportes`, crear un reporte, previsualizar, guardar, ejecutar, ver la tabla; eliminar.
5. Verificar que POST/PUT/DELETE dejan registro en la tabla `logs` con `entity_type = 'reports'`.

## Fuera de alcance (iteraciones siguientes)

- Reporte `moodle_students_at_risk` (inactividad por `mdl_user.lastaccess` / `mdl_user_lastaccess`).
- Reportes desde apps internas de Bravo Suite (`services/reports/internal/`).
- Exportación a CSV/Excel.
- Snapshots de resultados / comparación histórica.
- Programación de reportes / envío por correo.
