# Módulo Reportes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un módulo de Reportes que permite guardar definiciones de reporte en Postgres y ejecutarlas al vuelo, con un primer reporte funcional que cuenta cursos y estudiantes por categoría de Moodle.

**Architecture:** Se replica el patrón de módulos del repo: `api/reports/` (`controller.js` factory + `index.js` + `network.js` con `checkAuth`/`checkPermission('reports')`/`saveLog('reports')`), capa DB en `database/querysets.js` + `database/postgresql.js`, y servicios en `services/reports/` (dispatcher `runReport` + generador `moodle/coursesByCategory`). El acceso a Moodle es MySQL directo vía el pool `database/mysqlMoodle.js`. El front reemplaza el stub `Reportes.jsx` por una vista lista+formulario+tabla de resultado, con servicios axios en `src/services/reportes/`.

**Tech Stack:** Node.js, Express, `pg` (Postgres), `mysql2/promise` (Moodle), React + Vite, axios.

**Spec:** `docs/superpowers/specs/2026-09-10-reportes-modulo-design.md`

## Global Constraints

- Schema Postgres: se referencia siempre como `${schema}` desde `config.postgresql.schema` (valor por defecto `test`). Nunca hardcodear el nombre del schema.
- Toda ruta del módulo lleva `checkAuth` + `checkPermission('reports')`. Las rutas `POST`/`PUT`/`DELETE` (y `POST /reports/run`) agregan `saveLog('reports')` inmediatamente después de `checkPermission`.
- El submódulo `reports` YA existe en BD (sembrado por `database/seeds/moveIntegrationReportsToAdmin.js`). No crear seed de permisos.
- No se agrega framework de tests (`npm test` es un stub). La verificación es `node --check`, scripts `node -e` puntuales, y `npm run build` en el front.
- Acceso a Moodle: solo MySQL directo con `require('../../database/mysqlMoodle')` (pool `moodleDB`, prefijo de tablas `mdl_`, placeholders `?`, resultado `const [rows] = await moodleDB.query(text, values)`). No usar `moodleService.moodleRequest` (REST).
- Formato unificado que devuelven `runReport` y todo generador: `{ columns: [{key,label}], rows: [{...}], meta: { tipo, params, generatedAt } }`.
- Módulo del monorepo backend: rutas relativas al repo `journey-api`. El front vive en `journey-front` (repo hermano); las rutas del Task 5 y 6 son relativas a `journey-front`.
- `req.user` tras `checkAuth` es `{ email, sub }`. `created_by` del reporte = `req.user.email`.
- Commits en la rama actual `brand_branch`. Un commit por task.

---

## File Structure

**journey-api**
- `database/seeds/addReportsTable.js` — *crear*. Seed idempotente que crea la tabla `reports`.
- `database/querysets.js` — *modificar*. Builders de queries de `reports` (Postgres) + builder de conteo por categoría (Moodle/MySQL).
- `database/postgresql.js` — *modificar*. Wrappers Promise para las 5 operaciones CRUD de `reports`.
- `services/reports/moodle/coursesByCategory.js` — *crear*. Generador del reporte `moodle_courses_by_category`.
- `services/reports/runReport.js` — *crear*. Dispatcher por `tipo`.
- `api/reports/controller.js` — *crear*. Factory con la lógica del módulo + catálogo `TIPOS`.
- `api/reports/index.js` — *crear*. Inyecta `database/postgresql` al controller.
- `api/reports/network.js` — *crear*. Router Express + swagger.
- `api/index.js` — *modificar*. Alta del router `/reports`.

**journey-front**
- `src/services/reportes/fetchReportes.js` — *crear*.
- `src/services/reportes/fetchTiposReporte.js` — *crear*.
- `src/services/reportes/createReporte.js` — *crear*.
- `src/services/reportes/updateReporte.js` — *crear*.
- `src/services/reportes/deleteReporte.js` — *crear*.
- `src/services/reportes/runReporte.js` — *crear*.
- `src/services/reportes/runReporteAdHoc.js` — *crear*.
- `src/pages/main/Reportes/TablaResultado.jsx` — *crear*. Componente genérico de tabla.
- `src/pages/main/Reportes/Reportes.jsx` — *modificar* (reemplaza el stub `EnConstruccion`).
- `src/styles/main/Reportes/Reportes.css` — *crear*.

---

## Task 1: Seed de la tabla `reports`

**Files:**
- Create: `database/seeds/addReportsTable.js`

**Interfaces:**
- Consumes: nada.
- Produces: tabla `${schema}.reports` con columnas `id, nombre, tipo, params, descripcion, created_by, created_at, updated_at`.

- [ ] **Step 1: Crear el seed**

Archivo `database/seeds/addReportsTable.js` (patrón idéntico a `database/seeds/addCourseSyncStatusColumn.js`):

```js
// Crea la tabla `reports` (definiciones de reporte del módulo Reportes).
// Guarda solo la definición (nombre, tipo, parámetros); el resultado se calcula
// al vuelo en cada ejecución, no se hace snapshot.
// Idempotente: CREATE TABLE IF NOT EXISTS.
// Uso: node database/seeds/addReportsTable.js

const { Pool } = require('pg');
const config = require('../../config');

const pool = new Pool({
    database: config.postgresql.database,
    user:     config.postgresql.user,
    password: config.postgresql.password,
    host:     config.postgresql.host,
    port:     config.postgresql.port,
});
const schema = config.postgresql.schema;

async function main() {
    console.log(`Creando tabla ${schema}.reports (si no existe)...`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.reports (
            id          SERIAL PRIMARY KEY,
            nombre      TEXT NOT NULL,
            tipo        TEXT NOT NULL,
            params      JSONB NOT NULL DEFAULT '{}'::jsonb,
            descripcion TEXT,
            created_by  TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error creando la tabla reports:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check database/seeds/addReportsTable.js`
Expected: sin salida (exit 0).

- [ ] **Step 3: Ejecutar el seed**

Run: `node database/seeds/addReportsTable.js`
Expected: imprime `Creando tabla test.reports (si no existe)...` y `Listo.` sin errores. (Requiere el túnel/BD Postgres en el puerto 5434 arriba — ver memoria `journey-entorno-local`.)

- [ ] **Step 4: Verificar la tabla**

Run:
```bash
node -e "const {Pool}=require('pg');const c=require('./config');const p=new Pool({database:c.postgresql.database,user:c.postgresql.user,password:c.postgresql.password,host:c.postgresql.host,port:c.postgresql.port});p.query(\`SELECT column_name FROM information_schema.columns WHERE table_schema='\${c.postgresql.schema}' AND table_name='reports' ORDER BY ordinal_position\`).then(r=>{console.log(r.rows.map(x=>x.column_name));return p.end()})"
```
Expected: `[ 'id', 'nombre', 'tipo', 'params', 'descripcion', 'created_by', 'created_at', 'updated_at' ]`

- [ ] **Step 5: Commit**

```bash
git add database/seeds/addReportsTable.js
git commit -m "feat(reportes): seed de la tabla reports"
```

---

## Task 2: Capa de datos — querysets + wrappers

**Files:**
- Modify: `database/querysets.js`
- Modify: `database/postgresql.js`

**Interfaces:**
- Consumes: tabla `${schema}.reports` (Task 1); pool `moodleDB` de `database/mysqlMoodle.js`.
- Produces (desde `database/postgresql.js`):
  - `listReports() => Promise<Array<Report>>`
  - `findReportById(id) => Promise<Report|null>`
  - `insertReport({ nombre, tipo, params, descripcion, created_by }) => Promise<[Report]>`
  - `updateReport(id, { nombre, params, descripcion }) => Promise<[Report]>`
  - `deleteReport(id) => Promise<Array>`
  - Donde `Report = { id, nombre, tipo, params (object), descripcion, created_by, created_at, updated_at }`.
- Produces (desde `database/querysets.js`, para uso directo del servicio):
  - `countCoursesStudentsByCategory({ categoryId, incluirSubcategorias }) => { text, values }` (SQL MySQL con placeholders `?`).

- [ ] **Step 1: Agregar builders de `reports` en `querysets.js`**

En `database/querysets.js`, justo **antes** de la línea `// ─── EXPORTS ──` / el `module.exports` final, agregar la sección:

```js
// ─── REPORTS ──────────────────────────────────────────────────────────────────

const selectAllReports = () => ({
    text: `SELECT * FROM ${schema}.reports ORDER BY created_at DESC`,
    values: []
});

const selectReportById = (id) => ({
    text: `SELECT * FROM ${schema}.reports WHERE id = $1`,
    values: [id]
});

const insertReportData = ({ nombre, tipo, params, descripcion, created_by }) => ({
    text: `
        INSERT INTO ${schema}.reports (nombre, tipo, params, descripcion, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `,
    values: [nombre, tipo, params ?? {}, descripcion ?? null, created_by ?? null]
});

const updateReportData = (id, { nombre, params, descripcion }) => ({
    text: `
        UPDATE ${schema}.reports
        SET nombre = $1, params = $2, descripcion = $3, updated_at = now()
        WHERE id = $4
        RETURNING *
    `,
    values: [nombre, params ?? {}, descripcion ?? null, id]
});

const deleteReportData = (id) => ({
    text: `DELETE FROM ${schema}.reports WHERE id = $1`,
    values: [id]
});
```

Nota: `pg` serializa el objeto JS de `params` a `jsonb` automáticamente cuando se pasa como valor de placeholder.

- [ ] **Step 2: Agregar el builder de conteo por categoría en la sección MOODLE de `querysets.js`**

En `database/querysets.js`, dentro de la sección `// ─── MOODLE ──` (donde ya están `findMoodleUserByUsername` / `findMoodleEnrolmentId`), agregar:

```js
// Conteo de cursos y estudiantes (rol 'student') por categoría de Moodle.
// - categoryId null  => todas las categorías.
// - categoryId + incluirSubcategorias => la categoría indicada y todas las que
//   cuelgan de ella (mdl_course_categories.path, ej. "/1/5/12").
// Esquema estándar de Moodle (mdl_course/mdl_course_categories/mdl_context/
// mdl_role_assignments/mdl_role), estable de 2.x a 4.x.
const countCoursesStudentsByCategory = ({ categoryId = null, incluirSubcategorias = true }) => {
    const where = [];
    const values = [];
    if (categoryId != null) {
        if (incluirSubcategorias) {
            where.push(`(cc.id = ? OR cc.path LIKE CONCAT((SELECT path FROM mdl_course_categories WHERE id = ?), '/%'))`);
            values.push(categoryId, categoryId);
        } else {
            where.push(`cc.id = ?`);
            values.push(categoryId);
        }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return {
        text: `
            SELECT cc.id   AS categoria_id,
                   cc.name AS categoria,
                   cc.path AS path,
                   COUNT(DISTINCT c.id) AS cursos,
                   COUNT(DISTINCT CASE WHEN r.shortname = 'student' THEN ra.userid END) AS estudiantes
            FROM mdl_course_categories cc
            LEFT JOIN mdl_course c            ON c.category = cc.id AND c.id <> 1
            LEFT JOIN mdl_context ctx         ON ctx.instanceid = c.id AND ctx.contextlevel = 50
            LEFT JOIN mdl_role_assignments ra ON ra.contextid = ctx.id
            LEFT JOIN mdl_role r              ON r.id = ra.roleid
            ${whereSql}
            GROUP BY cc.id, cc.name, cc.path
            ORDER BY cc.name
        `,
        values
    };
};
```

- [ ] **Step 3: Exportar los nuevos builders**

En el `module.exports` de `database/querysets.js`, agregar (respetando el estilo del bloque):

```js
    selectAllReports,
    selectReportById,
    insertReportData,
    updateReportData,
    deleteReportData,
    countCoursesStudentsByCategory,
```

- [ ] **Step 4: Importar los builders de `reports` en `postgresql.js`**

En `database/postgresql.js`, en el `require('./querysets')` destructurado del inicio del archivo, agregar:

```js
    selectAllReports,
    selectReportById,
    insertReportData,
    updateReportData,
    deleteReportData,
```

(NO importar `countCoursesStudentsByCategory` aquí — lo usa directamente el servicio, igual que `services/moodle/getMoodleUser.js` usa `queries.findMoodleUserByUsername`.)

- [ ] **Step 5: Agregar los wrappers en `postgresql.js`**

En `database/postgresql.js`, antes del `module.exports` final, agregar la sección:

```js
// ─── REPORTS ──────────────────────────────────────────────────────────────────

function listReports() {
    return new Promise((resolve, reject) => {
        pool.query(selectAllReports(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findReportById(id) {
    return new Promise((resolve, reject) => {
        pool.query(selectReportById(id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows[0] || null);
        });
    });
}

function insertReport(dataIn) {
    return new Promise((resolve, reject) => {
        pool.query(insertReportData(dataIn), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateReport(id, dataIn) {
    return new Promise((resolve, reject) => {
        pool.query(updateReportData(id, dataIn), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function deleteReport(id) {
    return new Promise((resolve, reject) => {
        pool.query(deleteReportData(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}
```

- [ ] **Step 6: Exportar los wrappers en `postgresql.js`**

En el `module.exports` de `database/postgresql.js`, agregar:

```js
    listReports,
    findReportById,
    insertReport,
    updateReport,
    deleteReport,
```

- [ ] **Step 7: Verificar sintaxis**

Run: `node --check database/querysets.js && node --check database/postgresql.js`
Expected: sin salida (exit 0).

- [ ] **Step 8: Verificar el CRUD contra la BD**

Run:
```bash
node -e "const db=require('./database/postgresql');(async()=>{const [c]=await db.insertReport({nombre:'tmp',tipo:'moodle_courses_by_category',params:{a:1},descripcion:null,created_by:'test@x.com'});console.log('insert',c.id,c.params);const g=await db.findReportById(c.id);console.log('find',g.nombre);const [u]=await db.updateReport(c.id,{nombre:'tmp2',params:{b:2},descripcion:'d'});console.log('update',u.nombre,u.params);const l=await db.listReports();console.log('list len',l.length);await db.deleteReport(c.id);console.log('deleted');process.exit(0)})().catch(e=>{console.error(e);process.exit(1)})"
```
Expected: imprime `insert <id> { a: 1 }`, `find tmp`, `update tmp2 { b: 2 }`, `list len <n>`, `deleted`, sin errores.

- [ ] **Step 9: Commit**

```bash
git add database/querysets.js database/postgresql.js
git commit -m "feat(reportes): capa de datos (querysets + wrappers CRUD de reports)"
```

---

## Task 3: Servicios — generador `coursesByCategory` + dispatcher `runReport`

**Files:**
- Create: `services/reports/moodle/coursesByCategory.js`
- Create: `services/reports/runReport.js`

**Interfaces:**
- Consumes: `queries.countCoursesStudentsByCategory` (Task 2), pool `moodleDB` (`database/mysqlMoodle.js`).
- Produces:
  - `coursesByCategory(params) => Promise<{ columns, rows, meta }>` (módulo `services/reports/moodle/coursesByCategory.js`, export nombrado).
  - `runReport(tipo, params) => Promise<{ columns, rows, meta }>` (módulo `services/reports/runReport.js`, export nombrado). Tipo desconocido → `throw` de un `Error` con `.status = 400`.

- [ ] **Step 1: Crear el generador**

Archivo `services/reports/moodle/coursesByCategory.js`:

```js
const moodleDB = require('../../../database/mysqlMoodle');
const queries = require('../../../database/querysets');

// Reporte 'moodle_courses_by_category': conteo de cursos y estudiantes por
// categoría de Moodle. Lee directo de la BD de Moodle (mismo patrón que
// services/moodle/*). Devuelve el formato unificado { columns, rows, meta }.
async function coursesByCategory(params = {}) {
    const categoryId = params.categoryId != null && params.categoryId !== ''
        ? Number(params.categoryId)
        : null;
    const incluirSubcategorias = params.incluirSubcategorias !== false;

    const query = queries.countCoursesStudentsByCategory({ categoryId, incluirSubcategorias });
    const [rows] = await moodleDB.query(query.text, query.values);

    return {
        columns: [
            { key: 'categoria', label: 'Categoría' },
            { key: 'cursos', label: 'Cursos' },
            { key: 'estudiantes', label: 'Estudiantes' },
        ],
        rows: rows.map((r) => ({
            categoria: r.categoria,
            cursos: Number(r.cursos),
            estudiantes: Number(r.estudiantes),
        })),
        meta: {
            tipo: 'moodle_courses_by_category',
            params: { categoryId, incluirSubcategorias },
            generatedAt: new Date().toISOString(),
        },
    };
}

module.exports = { coursesByCategory };
```

- [ ] **Step 2: Crear el dispatcher**

Archivo `services/reports/runReport.js`:

```js
const { coursesByCategory } = require('./moodle/coursesByCategory');

// Dispatcher de reportes. Recibe el código de tipo y los parámetros de la
// definición, ejecuta el generador correspondiente y devuelve el formato
// unificado { columns, rows, meta }. Tipo desconocido => Error 400.
async function runReport(tipo, params = {}) {
    switch (tipo) {
        case 'moodle_courses_by_category':
            return coursesByCategory(params);
        default: {
            const err = new Error(`Tipo de reporte no soportado: ${tipo}`);
            err.status = 400;
            throw err;
        }
    }
}

module.exports = { runReport };
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check services/reports/moodle/coursesByCategory.js && node --check services/reports/runReport.js`
Expected: sin salida (exit 0).

- [ ] **Step 4: Verificar tipo desconocido (no requiere BD)**

Run:
```bash
node -e "require('./services/reports/runReport').runReport('no_existe',{}).then(()=>{console.error('NO lanzó');process.exit(1)}).catch(e=>{console.log('ok:',e.message,'status',e.status);process.exit(e.status===400?0:1)})"
```
Expected: `ok: Tipo de reporte no soportado: no_existe status 400`

- [ ] **Step 5: Verificar el generador contra Moodle DB**

Requiere acceso a la BD MySQL de Moodle (`config.moodle_db`). Si no hay acceso en el entorno, marcar este step como verificado en la prueba manual del Task 4 y anotarlo.

Run:
```bash
node -e "require('./services/reports/runReport').runReport('moodle_courses_by_category',{}).then(r=>{console.log('columns',r.columns.map(c=>c.key));console.log('rows',r.rows.length);console.log('sample',r.rows[0]);console.log('meta',r.meta);process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})"
```
Expected: `columns [ 'categoria', 'cursos', 'estudiantes' ]`, `rows <n>` con `n >= 1`, un `sample` con números en `cursos`/`estudiantes`, y `meta` con `tipo`, `params`, `generatedAt`.

- [ ] **Step 6: Commit**

```bash
git add services/reports/
git commit -m "feat(reportes): servicio de conteo por categoría y dispatcher runReport"
```

---

## Task 4: Módulo API `api/reports/`

**Files:**
- Create: `api/reports/controller.js`
- Create: `api/reports/index.js`
- Create: `api/reports/network.js`
- Modify: `api/index.js`

**Interfaces:**
- Consumes: `database/postgresql` (wrappers del Task 2), `services/reports/runReport` (Task 3), middlewares `checkAuth` / `checkPermissions` / `saveLog`, `network/response`.
- Produces (controller, tras `ctrl(database)`):
  - `tiposDisponibles() => Array<{ tipo, label, fuente, params }>`
  - `listReportes() => Promise<Array>`
  - `getReporte(id) => Promise<Report>` (404 si no existe)
  - `createReporte(body, createdByEmail) => Promise<Report>` (400 si falta `nombre`/`tipo` o `tipo` no está en `TIPOS`)
  - `updateReporte(id, body) => Promise<Report>` (404 si no existe)
  - `deleteReporte(id) => Promise<{ id }>` (404 si no existe)
  - `ejecutarReporte(id) => Promise<{ columns, rows, meta }>` (404 si no existe)
  - `ejecutarAdHoc(tipo, params) => Promise<{ columns, rows, meta }>` (400 si falta `tipo` o no soportado)
- Produces (HTTP, montado en `/reports`): ver tabla de rutas en Step 3.

- [ ] **Step 1: Crear el controller**

Archivo `api/reports/controller.js`:

```js
const { runReport } = require('../../services/reports/runReport');

// Catálogo estático de tipos de reporte disponibles. El front lo consume para
// armar el formulario de parámetros de forma dinámica. Al agregar un tipo nuevo:
// 1) generador en services/reports/, 2) case en runReport, 3) entrada aquí.
const TIPOS = [
    {
        tipo: 'moodle_courses_by_category',
        label: 'Cursos y estudiantes por categoría (Moodle)',
        fuente: 'moodle',
        params: [
            { key: 'categoryId', label: 'Categoría (id)', type: 'number', required: false },
            { key: 'incluirSubcategorias', label: 'Incluir subcategorías', type: 'boolean', default: true },
        ],
    },
];

module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    function tiposDisponibles() {
        return TIPOS;
    }

    async function listReportes() {
        return data.listReports();
    }

    async function getReporte(id) {
        const report = await data.findReportById(id);
        if (!report) {
            const err = new Error('Reporte no encontrado');
            err.status = 404;
            throw err;
        }
        return report;
    }

    async function createReporte(body, createdByEmail) {
        const { nombre, tipo } = body;
        if (!nombre || !tipo) {
            const err = new Error('nombre y tipo son obligatorios');
            err.status = 400;
            throw err;
        }
        if (!TIPOS.some((t) => t.tipo === tipo)) {
            const err = new Error(`Tipo de reporte no soportado: ${tipo}`);
            err.status = 400;
            throw err;
        }
        const rows = await data.insertReport({
            nombre,
            tipo,
            params: body.params || {},
            descripcion: body.descripcion || null,
            created_by: createdByEmail || null,
        });
        return rows[0];
    }

    async function updateReporte(id, body) {
        await getReporte(id);
        const rows = await data.updateReport(id, {
            nombre: body.nombre,
            params: body.params || {},
            descripcion: body.descripcion || null,
        });
        return rows[0];
    }

    async function deleteReporte(id) {
        await getReporte(id);
        await data.deleteReport(id);
        return { id: Number(id) };
    }

    async function ejecutarReporte(id) {
        const def = await getReporte(id);
        return runReport(def.tipo, def.params || {});
    }

    async function ejecutarAdHoc(tipo, params) {
        if (!tipo) {
            const err = new Error('tipo es obligatorio');
            err.status = 400;
            throw err;
        }
        return runReport(tipo, params || {});
    }

    return {
        tiposDisponibles,
        listReportes,
        getReporte,
        createReporte,
        updateReporte,
        deleteReporte,
        ejecutarReporte,
        ejecutarAdHoc,
    };
};
```

- [ ] **Step 2: Crear el index**

Archivo `api/reports/index.js` (idéntico en forma a `api/admin/index.js`):

```js
const database = require('../../database/postgresql');
const ctrl = require('./controller');

module.exports = ctrl(database);
```

- [ ] **Step 3: Crear el network (router)**

Archivo `api/reports/network.js`. Orden de rutas: las rutas literales (`/tipos`, `/run`) van **antes** de `/:id` para que Express no las matchee como parámetro.

```js
const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const checkAuth = require('../../middleware/checkAuth');
const checkPermission = require('../../middleware/checkPermissions');
const saveLog = require('../../middleware/saveLog');

const PERM = 'reports';

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Módulo de Reportes (definiciones guardadas + ejecución)
 */

/**
 * @swagger
 * /reports/tipos:
 *   get:
 *     summary: Catálogo de tipos de reporte disponibles
 *     tags: [Reports]
 *     responses:
 *       200: { description: Lista de tipos con su schema de parámetros }
 */
router.get('/tipos', checkAuth, checkPermission(PERM), async (req, res, next) => {
    try {
        response.success(req, res, ctrl.tiposDisponibles(), 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /reports/run:
 *   post:
 *     summary: Ejecutar un reporte ad-hoc (sin guardarlo)
 *     tags: [Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo]
 *             properties:
 *               tipo:   { type: string }
 *               params: { type: object }
 *     responses:
 *       200: { description: Resultado del reporte }
 *       400: { description: Tipo no soportado o faltan datos }
 */
router.post('/run', checkAuth, checkPermission(PERM), saveLog(PERM), async (req, res, next) => {
    try {
        const result = await ctrl.ejecutarAdHoc(req.body.tipo, req.body.params || {});
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /reports:
 *   get:
 *     summary: Listar definiciones de reporte guardadas
 *     tags: [Reports]
 *     responses:
 *       200: { description: Lista de reportes }
 */
router.get('/', checkAuth, checkPermission(PERM), async (req, res, next) => {
    try {
        const result = await ctrl.listReportes();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /reports/{id}:
 *   get:
 *     summary: Obtener una definición de reporte
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Definición del reporte }
 *       404: { description: Reporte no encontrado }
 */
router.get('/:id', checkAuth, checkPermission(PERM), async (req, res, next) => {
    try {
        const result = await ctrl.getReporte(req.params.id);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /reports/{id}/run:
 *   get:
 *     summary: Ejecutar un reporte guardado
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Resultado del reporte }
 *       404: { description: Reporte no encontrado }
 */
router.get('/:id/run', checkAuth, checkPermission(PERM), async (req, res, next) => {
    try {
        const result = await ctrl.ejecutarReporte(req.params.id);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /reports:
 *   post:
 *     summary: Crear una definición de reporte
 *     tags: [Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, tipo]
 *             properties:
 *               nombre:      { type: string }
 *               tipo:        { type: string }
 *               descripcion: { type: string }
 *               params:      { type: object }
 *     responses:
 *       200: { description: Reporte creado }
 *       400: { description: Faltan datos o tipo no soportado }
 */
router.post('/', checkAuth, checkPermission(PERM), saveLog(PERM), async (req, res, next) => {
    try {
        const result = await ctrl.createReporte(req.body, req.user.email);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /reports/{id}:
 *   put:
 *     summary: Editar una definición de reporte
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:      { type: string }
 *               descripcion: { type: string }
 *               params:      { type: object }
 *     responses:
 *       200: { description: Reporte actualizado }
 *       404: { description: Reporte no encontrado }
 */
router.put('/:id', checkAuth, checkPermission(PERM), saveLog(PERM), async (req, res, next) => {
    try {
        const result = await ctrl.updateReporte(req.params.id, req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /reports/{id}:
 *   delete:
 *     summary: Eliminar una definición de reporte
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Reporte eliminado }
 *       404: { description: Reporte no encontrado }
 */
router.delete('/:id', checkAuth, checkPermission(PERM), saveLog(PERM), async (req, res, next) => {
    try {
        const result = await ctrl.deleteReporte(req.params.id);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
```

- [ ] **Step 4: Alta del router en `api/index.js`**

En `api/index.js`:

1. Junto a los demás `require` de módulos (después de `const virtualLabs = require('./virtual_labs/network');`) agregar:
```js
const reports = require('./reports/network');
```
2. En el bloque `// ─── MÓDULOS ──`, después de `app.use('/virtual_labs', virtualLabs);` agregar:
```js
app.use('/reports', reports);
```

- [ ] **Step 5: Verificar sintaxis y carga**

Run:
```bash
node --check api/reports/controller.js && node --check api/reports/index.js && node --check api/reports/network.js && node --check api/index.js
```
Expected: sin salida (exit 0).

Run:
```bash
node -e "const c=require('./api/reports/index');console.log(Object.keys(c));console.log(c.tiposDisponibles()[0].tipo)"
```
Expected: imprime el array de métodos del controller y `moodle_courses_by_category`.

- [ ] **Step 6: Verificar el router HTTP (arranque + petición autenticada)**

Requiere token AWS válido de un usuario con permiso `reports` y BD Postgres arriba.

1. `npm run dev` (levanta en `http://localhost:3001`).
2. En otra terminal, con `TOKEN` exportado:
```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/reports/tipos
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/reports
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Cursos por categoría raíz","tipo":"moodle_courses_by_category","params":{"categoryId":1}}' \
  http://localhost:3001/reports
# tomar el id devuelto en .body.id
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/reports/<id>/run
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tipo":"moodle_courses_by_category","params":{}}' http://localhost:3001/reports/run
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:3001/reports/<id>
```
Expected: `/tipos` devuelve `{ error:false, body:[...] }`; el `POST /reports` devuelve el reporte con `id`; `/<id>/run` y `/run` devuelven `{ body: { columns, rows, meta } }`; `DELETE` devuelve `{ body: { id } }`. Sin token → 401.
3. Verificar auditoría:
```bash
node -e "require('./database/postgresql').listLogs(10).then(r=>{console.log(r.filter(x=>x.entity_type==='reports'));process.exit(0)})"
```
Expected: hay filas con `entity_type = 'reports'` para el POST y el DELETE.

- [ ] **Step 7: Commit**

```bash
git add api/reports/ api/index.js
git commit -m "feat(reportes): módulo API /reports (CRUD + ejecución + tipos)"
```

---

## Task 5: Servicios del front `src/services/reportes/`

> Rutas relativas al repo `journey-front`.

**Files:**
- Create: `src/services/reportes/fetchReportes.js`
- Create: `src/services/reportes/fetchTiposReporte.js`
- Create: `src/services/reportes/createReporte.js`
- Create: `src/services/reportes/updateReporte.js`
- Create: `src/services/reportes/deleteReporte.js`
- Create: `src/services/reportes/runReporte.js`
- Create: `src/services/reportes/runReporteAdHoc.js`

**Interfaces:**
- Consumes: `config.api_domain.url_base`, `awsAuth.getToken()`, endpoints del Task 4.
- Produces (todos export nombrado, todos devuelven `res.data?.body` y lanzan `new Error(msg, { cause })` en fallo):
  - `fetchReportes() => Promise<Array>`
  - `fetchTiposReporte() => Promise<Array>`
  - `createReporte({ nombre, descripcion, tipo, params }) => Promise<Report>`
  - `updateReporte(id, { nombre, descripcion, params }) => Promise<Report>`
  - `deleteReporte(id) => Promise<{ id }>`
  - `runReporte(id) => Promise<{ columns, rows, meta }>`
  - `runReporteAdHoc({ tipo, params }) => Promise<{ columns, rows, meta }>`

- [ ] **Step 1: `fetchReportes.js`**

```js
import axios from 'axios'
import config from '../../config'
import awsAuth from '../AwsAuthService'

const BASE = config.api_domain.url_base

export const fetchReportes = async () => {
  try {
    const token = awsAuth.getToken()
    const res = await axios.get(`${BASE}/reports`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data?.body || []
  } catch (error) {
    console.error(error)
    throw new Error(error.response?.data?.body || 'Error al obtener los reportes', { cause: error })
  }
}
```

- [ ] **Step 2: `fetchTiposReporte.js`**

```js
import axios from 'axios'
import config from '../../config'
import awsAuth from '../AwsAuthService'

const BASE = config.api_domain.url_base

export const fetchTiposReporte = async () => {
  try {
    const token = awsAuth.getToken()
    const res = await axios.get(`${BASE}/reports/tipos`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data?.body || []
  } catch (error) {
    console.error(error)
    throw new Error(error.response?.data?.body || 'Error al obtener los tipos de reporte', { cause: error })
  }
}
```

- [ ] **Step 3: `createReporte.js`**

```js
import axios from 'axios'
import config from '../../config'
import awsAuth from '../AwsAuthService'

const BASE = config.api_domain.url_base

export const createReporte = async (data) => {
  try {
    const token = awsAuth.getToken()
    const res = await axios.post(`${BASE}/reports`, data, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data?.body
  } catch (error) {
    console.error(error)
    throw new Error(error.response?.data?.body || 'Error al crear el reporte', { cause: error })
  }
}
```

- [ ] **Step 4: `updateReporte.js`**

```js
import axios from 'axios'
import config from '../../config'
import awsAuth from '../AwsAuthService'

const BASE = config.api_domain.url_base

export const updateReporte = async (id, data) => {
  try {
    const token = awsAuth.getToken()
    const res = await axios.put(`${BASE}/reports/${id}`, data, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data?.body
  } catch (error) {
    console.error(error)
    throw new Error(error.response?.data?.body || 'Error al actualizar el reporte', { cause: error })
  }
}
```

- [ ] **Step 5: `deleteReporte.js`**

```js
import axios from 'axios'
import config from '../../config'
import awsAuth from '../AwsAuthService'

const BASE = config.api_domain.url_base

export const deleteReporte = async (id) => {
  try {
    const token = awsAuth.getToken()
    const res = await axios.delete(`${BASE}/reports/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data?.body
  } catch (error) {
    console.error(error)
    throw new Error(error.response?.data?.body || 'Error al eliminar el reporte', { cause: error })
  }
}
```

- [ ] **Step 6: `runReporte.js`**

```js
import axios from 'axios'
import config from '../../config'
import awsAuth from '../AwsAuthService'

const BASE = config.api_domain.url_base

export const runReporte = async (id) => {
  try {
    const token = awsAuth.getToken()
    const res = await axios.get(`${BASE}/reports/${id}/run`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data?.body
  } catch (error) {
    console.error(error)
    throw new Error(error.response?.data?.body || 'Error al ejecutar el reporte', { cause: error })
  }
}
```

- [ ] **Step 7: `runReporteAdHoc.js`**

```js
import axios from 'axios'
import config from '../../config'
import awsAuth from '../AwsAuthService'

const BASE = config.api_domain.url_base

export const runReporteAdHoc = async ({ tipo, params }) => {
  try {
    const token = awsAuth.getToken()
    const res = await axios.post(`${BASE}/reports/run`, { tipo, params }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data?.body
  } catch (error) {
    console.error(error)
    throw new Error(error.response?.data?.body || 'Error al ejecutar el reporte', { cause: error })
  }
}
```

- [ ] **Step 8: Verificar sintaxis**

Run (desde `journey-front`): `node --check src/services/reportes/fetchReportes.js` para cada archivo, o:
```bash
for f in src/services/reportes/*.js; do node --check "$f" && echo "ok $f"; done
```
Expected: `ok` para los 7 archivos.

- [ ] **Step 9: Commit**

```bash
git add src/services/reportes/
git commit -m "feat(reportes): servicios del front para /reports"
```

---

## Task 6: Vista del front — `Reportes.jsx` + `TablaResultado.jsx` + CSS

> Rutas relativas al repo `journey-front`.

**Files:**
- Create: `src/pages/main/Reportes/TablaResultado.jsx`
- Modify: `src/pages/main/Reportes/Reportes.jsx` (reemplaza el stub `EnConstruccion`)
- Create: `src/styles/main/Reportes/Reportes.css`

**Interfaces:**
- Consumes: los 7 servicios del Task 5. Formato de resultado `{ columns:[{key,label}], rows:[{...}], meta:{ tipo, params, generatedAt } }`.
- Produces: componente default `Reportes` (ya referenciado por `src/App.jsx:36` y la ruta `admin/reportes`), y componente default `TablaResultado` con prop `{ resultado }`.

- [ ] **Step 1: Crear `TablaResultado.jsx`**

Archivo `src/pages/main/Reportes/TablaResultado.jsx`:

```jsx
export default function TablaResultado({ resultado }) {
  if (!resultado) return null
  const { columns = [], rows = [], meta = {} } = resultado

  return (
    <div className="reportes-resultado">
      <div className="reportes-resultado-meta">
        {rows.length} fila(s) · generado {meta.generatedAt ? new Date(meta.generatedAt).toLocaleString() : '—'}
      </div>
      <div className="reportes-tabla-scroll">
        <table className="reportes-tabla">
          <thead>
            <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length || 1}>Sin datos</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i}>{columns.map((c) => <td key={c.key}>{String(row[c.key] ?? '')}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Reemplazar `Reportes.jsx`**

Archivo `src/pages/main/Reportes/Reportes.jsx` (contenido completo — reemplaza el stub):

```jsx
import { useEffect, useState } from 'react'
import { fetchReportes } from '../../../services/reportes/fetchReportes'
import { fetchTiposReporte } from '../../../services/reportes/fetchTiposReporte'
import { createReporte } from '../../../services/reportes/createReporte'
import { deleteReporte } from '../../../services/reportes/deleteReporte'
import { runReporte } from '../../../services/reportes/runReporte'
import { runReporteAdHoc } from '../../../services/reportes/runReporteAdHoc'
import TablaResultado from './TablaResultado'
import '../../../styles/main/Reportes/Reportes.css'

const paramsIniciales = (tipo) => {
  const out = {}
  ;(tipo?.params || []).forEach((p) => {
    out[p.key] = p.default !== undefined ? p.default : (p.type === 'boolean' ? false : '')
  })
  return out
}

export default function Reportes() {
  const [reportes, setReportes] = useState([])
  const [tipos, setTipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipoCode, setTipoCode] = useState('')
  const [params, setParams] = useState({})
  const [saving, setSaving] = useState(false)

  const [resultado, setResultado] = useState(null)
  const [ejecutando, setEjecutando] = useState(false)

  const tipoSel = tipos.find((t) => t.tipo === tipoCode) || null

  const cargar = async () => {
    setLoading(true)
    setError('')
    try {
      const [rs, ts] = await Promise.all([fetchReportes(), fetchTiposReporte()])
      setReportes(rs)
      setTipos(ts)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const onTipoChange = (code) => {
    setTipoCode(code)
    setParams(paramsIniciales(tipos.find((t) => t.tipo === code)))
  }

  const setParam = (key, value) => setParams((prev) => ({ ...prev, [key]: value }))

  const abrirForm = () => {
    setNombre(''); setDescripcion(''); setTipoCode(''); setParams({})
    setShowForm(true)
  }

  const previsualizar = async () => {
    if (!tipoCode) return
    setEjecutando(true); setError('')
    try {
      setResultado(await runReporteAdHoc({ tipo: tipoCode, params }))
    } catch (e) {
      setError(e.message)
    } finally {
      setEjecutando(false)
    }
  }

  const guardar = async () => {
    if (!nombre || !tipoCode) { setError('Nombre y tipo son obligatorios'); return }
    setSaving(true); setError('')
    try {
      await createReporte({ nombre, descripcion, tipo: tipoCode, params })
      setShowForm(false)
      await cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const ejecutar = async (id) => {
    setEjecutando(true); setError('')
    try {
      setResultado(await runReporte(id))
    } catch (e) {
      setError(e.message)
    } finally {
      setEjecutando(false)
    }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este reporte?')) return
    setError('')
    try {
      await deleteReporte(id)
      await cargar()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="reportes-page">
      <div className="reportes-header">
        <h1>Reportes</h1>
        <button className="btn-primary" onClick={abrirForm}>Nuevo reporte</button>
      </div>

      {error && <div className="reportes-error">{error}</div>}

      {loading ? (
        <div className="loading-box"><span className="loader"></span>Cargando reportes...</div>
      ) : (
        <table className="reportes-tabla">
          <thead>
            <tr><th>Nombre</th><th>Tipo</th><th>Creado</th><th></th></tr>
          </thead>
          <tbody>
            {reportes.length === 0 ? (
              <tr><td colSpan={4}>No hay reportes guardados</td></tr>
            ) : reportes.map((r) => (
              <tr key={r.id}>
                <td>{r.nombre}</td>
                <td>{(tipos.find((t) => t.tipo === r.tipo) || {}).label || r.tipo}</td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                <td className="reportes-acciones">
                  <button className="btn-secondary" onClick={() => ejecutar(r.id)} disabled={ejecutando}>Ejecutar</button>
                  <button className="btn-secondary" onClick={() => eliminar(r.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <div className="reportes-form">
          <h2>Nuevo reporte</h2>
          <label>Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label>Descripción
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </label>
          <label>Tipo
            <select value={tipoCode} onChange={(e) => onTipoChange(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {tipos.map((t) => <option key={t.tipo} value={t.tipo}>{t.label}</option>)}
            </select>
          </label>

          {tipoSel && (tipoSel.params || []).map((p) => (
            <label key={p.key}>{p.label}
              {p.type === 'boolean' ? (
                <input type="checkbox" checked={!!params[p.key]} onChange={(e) => setParam(p.key, e.target.checked)} />
              ) : (
                <input
                  type={p.type === 'number' ? 'number' : 'text'}
                  value={params[p.key] ?? ''}
                  onChange={(e) => setParam(p.key, e.target.value)}
                />
              )}
            </label>
          ))}

          <div className="reportes-form-acciones">
            <button className="btn-secondary" onClick={previsualizar} disabled={!tipoCode || ejecutando}>Previsualizar</button>
            <button className="btn-primary" onClick={guardar} disabled={saving}>Guardar</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {ejecutando && <div className="loading-box"><span className="loader"></span>Ejecutando reporte...</div>}
      {!ejecutando && resultado && <TablaResultado resultado={resultado} />}
    </div>
  )
}
```

Nota: si al construir aparece un lint error por `EnConstruccion` sin usar, ya no se importa — el archivo se reemplaza completo, no queda referencia.

- [ ] **Step 3: Crear el CSS**

Archivo `src/styles/main/Reportes/Reportes.css`:

```css
.reportes-page { padding: 24px; }
.reportes-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.reportes-error { background: #fde8e8; color: #9b1c1c; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; }
.reportes-tabla { width: 100%; border-collapse: collapse; }
.reportes-tabla th,
.reportes-tabla td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
.reportes-acciones { display: flex; gap: 8px; }
.reportes-form { margin-top: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; flex-direction: column; gap: 12px; max-width: 480px; }
.reportes-form label { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
.reportes-form-acciones { display: flex; gap: 8px; }
.reportes-resultado { margin-top: 24px; }
.reportes-resultado-meta { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
.reportes-tabla-scroll { overflow-x: auto; }
```

- [ ] **Step 4: Build del front**

Run (desde `journey-front`): `npm run build`
Expected: build de Vite exitoso, sin errores de import ni de sintaxis.

- [ ] **Step 5: Verificación manual en el navegador**

1. `npm run dev` (front) + API corriendo.
2. Login con usuario que tenga permiso `reports`.
3. Ir a `/admin/reportes`:
   - la tabla carga (vacía o con reportes previos), sin el cartel "En construcción".
   - **Nuevo reporte** → elegir "Cursos y estudiantes por categoría (Moodle)", aparecen los campos `Categoría (id)` e `Incluir subcategorías`.
   - **Previsualizar** → aparece `TablaResultado` con columnas Categoría / Cursos / Estudiantes.
   - **Guardar** → el reporte aparece en la tabla.
   - **Ejecutar** en la fila → vuelve a renderizar el resultado.
   - **Eliminar** → desaparece de la tabla.
4. Un usuario SIN permiso `reports` no ve la opción / recibe 401 (comportamiento de `PrivateRoute` + `checkPermission`, ya existente).

- [ ] **Step 6: Commit**

```bash
git add src/pages/main/Reportes/ src/styles/main/Reportes/
git commit -m "feat(reportes): vista de Reportes (lista, formulario y tabla de resultado)"
```

---

## Self-Review

**1. Spec coverage:**

| Requisito del spec | Task |
|---|---|
| Tabla `reports` (schema `test`, columnas indicadas) + seed idempotente | Task 1 |
| `querysets.js`: `selectAllReports`, `selectReportById`, `insertReportData`, `updateReportData`, `deleteReportData` | Task 2 Steps 1, 3 |
| `postgresql.js`: `listReports`, `findReportById`, `insertReport`, `updateReport`, `deleteReport` | Task 2 Steps 4–6 |
| Fuente Moodle vía `mysqlMoodle` (MySQL directo) | Task 2 Step 2, Task 3 Step 1 |
| `services/reports/runReport.js` dispatcher, tipo desconocido → 400 | Task 3 Step 2 |
| `services/reports/moodle/coursesByCategory.js` con formato unificado | Task 3 Step 1 |
| `api/reports/controller.js` factory + `TIPOS` + 8 métodos | Task 4 Step 1 |
| `api/reports/index.js` inyecta `database/postgresql` | Task 4 Step 2 |
| `api/reports/network.js` con las 8 rutas, swagger `[Reports]`, orden `/tipos` y `/run` antes de `/:id` | Task 4 Step 3 |
| `checkAuth` + `checkPermission('reports')` en toda ruta; `saveLog('reports')` en POST/PUT/DELETE + `/run` | Task 4 Step 3 |
| `created_by` = `req.user.email` | Task 4 Step 1 (`createReporte`), Step 3 (`req.user.email`) |
| Alta de `/reports` en `api/index.js` | Task 4 Step 4 |
| Front: 7 servicios en `src/services/reportes/` | Task 5 |
| Front: `Reportes.jsx` reemplaza stub, lista + form + params dinámicos + previsualizar + guardar + ejecutar + eliminar | Task 6 Step 2 |
| Front: `TablaResultado` genérico (`columns`/`rows`/`meta`) | Task 6 Step 1 |
| Front: CSS en `src/styles/main/Reportes/Reportes.css` | Task 6 Step 3 |
| Sin cambios en `App.jsx` / `SideNavItems.jsx` | No task los toca (confirmado) |
| Sin seed de permisos (submódulo `reports` ya existe) | No task lo crea (confirmado) |
| Manejo de errores con `err.status` (400/404) + `next(error)` | Task 4 Steps 1, 3 |
| Testing: verificación manual, sin runner nuevo | Steps de verificación de cada task |

Sin huecos.

**2. Placeholder scan:** No hay `TBD`/`TODO`/"implementar luego"/"validación apropiada". Cada step de código trae el contenido real. El único condicional ("si no hay acceso a Moodle DB, anotar") es una instrucción de verificación explícita, no un placeholder de implementación.

**3. Type consistency:**
- `listReports`/`findReportById`/`insertReport`/`updateReport`/`deleteReport` — mismos nombres en Task 2 (definición), Task 4 (`data.listReports()` etc.).
- `runReport(tipo, params)` — definido en Task 3, consumido en Task 4 (`controller.js`).
- `coursesByCategory(params)` — definido en Task 3 Step 1, consumido en Task 3 Step 2.
- `countCoursesStudentsByCategory({ categoryId, incluirSubcategorias })` — definido en Task 2 Step 2, consumido en Task 3 Step 1.
- Formato `{ columns, rows, meta }` — producido en Task 3, consumido por `TablaResultado` en Task 6 (mismas claves `columns`/`rows`/`meta`/`meta.generatedAt`).
- Servicios front: nombres `fetchReportes`, `fetchTiposReporte`, `createReporte`, `updateReporte`, `deleteReporte`, `runReporte`, `runReporteAdHoc` — idénticos entre Task 5 (definición) y Task 6 Step 2 (imports).
- `createReporte` en el front recibe `{ nombre, descripcion, tipo, params }`; el controller lee `nombre`, `tipo`, `body.params`, `body.descripcion` — consistente.
- `updateReporte(id, data)` en el front no se usa en la vista de este plan (queda disponible para "Editar" en una iteración siguiente); firma coherente con el endpoint `PUT /reports/:id`.

Sin inconsistencias.
