// Convierte las notificaciones viejas de SICAU (type 'sicau_novedad', una por
// novedad) en resúmenes agrupados 'sicau_resumen' (uno por nivel y día, igual
// que los genera ahora api/SICAU/controller.js:notificarNovedadSicau).
// Cada destinatario conserva su estado: el resumen queda sin leer para quien
// tenía alguna sin leer de ese grupo. Antes de borrar las viejas guarda un
// respaldo JSON (notificaciones + destinatarios) en la ruta indicada.
// Idempotente: si no quedan 'sicau_novedad', no hace nada.
// Uso: node database/seeds/groupOldSicauNotifications.js <ruta-respaldo.json>

const fs = require('fs');
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

const NIVEL_PLURAL = { usuario: 'usuarios', curso: 'cursos', matricula: 'matrículas' };
const tipoLabel = (t) => {
    const s = String(t || '').replace(/_/g, ' ').trim().toLowerCase();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Sin tipo';
};

async function main() {
    const backupPath = process.argv[2];
    if (!backupPath) throw new Error('Falta la ruta del respaldo: node database/seeds/groupOldSicauNotifications.js <ruta.json>');

    const { rows: viejas } = await pool.query(`
        SELECT n.*, (n.created_at AT TIME ZONE 'America/Bogota')::date::text AS dia
        FROM ${schema}.notifications n WHERE n.type = 'sicau_novedad' ORDER BY n.id`);
    if (viejas.length === 0) {
        console.log('No hay notificaciones sicau_novedad para agrupar.');
        return;
    }
    const { rows: destinatarios } = await pool.query(`
        SELECT r.* FROM ${schema}.notification_recipients r
        JOIN ${schema}.notifications n ON n.id = r.notification_id
        WHERE n.type = 'sicau_novedad'`);

    fs.writeFileSync(backupPath, JSON.stringify({ notifications: viejas, recipients: destinatarios }));
    console.log(`Respaldo: ${viejas.length} notificaciones y ${destinatarios.length} destinatarios en ${backupPath}`);

    // Agrupa por nivel + día.
    const grupos = new Map();
    for (const n of viejas) {
        const nivel = NIVEL_PLURAL[n.detail?.nivel] ? n.detail.nivel : 'otro';
        const key = `${nivel}|${n.dia}`;
        if (!grupos.has(key)) grupos.set(key, { nivel, dia: n.dia, ids: [], tipos: {}, ultima: n.created_at });
        const g = grupos.get(key);
        g.ids.push(n.id);
        const t = tipoLabel(n.detail?.tipo);
        g.tipos[t] = (g.tipos[t] || 0) + 1;
        if (n.created_at > g.ultima) g.ultima = n.created_at;
    }
    const porNotif = new Map();
    for (const r of destinatarios) {
        if (!porNotif.has(r.notification_id)) porNotif.set(r.notification_id, []);
        porNotif.get(r.notification_id).push(r);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const g of grupos.values()) {
            const total = g.ids.length;
            const title = `SICAU · ${total} novedad${total !== 1 ? 'es' : ''} de ${NIVEL_PLURAL[g.nivel] || 'otro tipo'}`;
            const body = Object.entries(g.tipos).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}: ${c}`).join(' · ');
            const { rows: [resumen] } = await client.query(`
                INSERT INTO ${schema}.notifications (created_at, type, title, body, entity_type, link, detail)
                VALUES ($1, 'sicau_resumen', $2, $3, 'sync_enrollments_novedades', $4, $5) RETURNING id`,
                [g.ultima, title, body, `/sync/novedades?tab=sicau&nivel=${g.nivel}`,
                 JSON.stringify({ nivel: g.nivel, dia: g.dia, total, tipos: g.tipos })]);

            // Por usuario: sin leer si tenía alguna sin leer; si no, la última lectura.
            const estado = new Map();
            for (const id of g.ids) {
                for (const r of porNotif.get(id) || []) {
                    const prev = estado.get(r.platform_user_id);
                    if (prev === undefined) estado.set(r.platform_user_id, r.read_at);
                    else if (prev !== null) estado.set(r.platform_user_id, r.read_at === null ? null : (r.read_at > prev ? r.read_at : prev));
                }
            }
            for (const [userId, readAt] of estado) {
                await client.query(`
                    INSERT INTO ${schema}.notification_recipients (notification_id, platform_user_id, read_at)
                    VALUES ($1, $2, $3)`, [resumen.id, userId, readAt]);
            }
            console.log(`${g.dia} ${g.nivel}: ${total} → 1 (${estado.size} destinatarios) — ${body}`);
        }
        const del = await client.query(`DELETE FROM ${schema}.notifications WHERE type = 'sicau_novedad'`);
        await client.query('COMMIT');
        console.log(`Borradas ${del.rowCount} notificaciones viejas; creados ${grupos.size} resúmenes.`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

main()
    .catch((err) => {
        console.error('Error agrupando notificaciones de SICAU:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
