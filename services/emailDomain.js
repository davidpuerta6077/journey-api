// Dominio de correo institucional (Configuración > Sistema, clave
// 'dominio_correo'). Si no está configurado, no se valida nada -- evita
// romper ambientes donde el admin todavía no lo llenó.
async function getDominioCorreoPermitido(data) {
    const rows = await data.getSettings('sistema');
    const row = (rows || []).find(s => s.clave === 'dominio_correo');
    const valor = row?.valor ? String(row.valor).trim().toLowerCase() : '';
    return valor ? valor.replace(/^@/, '') : null;
}

function emailTieneDominio(email, dominio) {
    if (!dominio) return true;
    return String(email || '').trim().toLowerCase().endsWith(`@${dominio}`);
}

module.exports = { getDominioCorreoPermitido, emailTieneDominio };
