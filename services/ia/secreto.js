const crypto = require('crypto');
const { iaError } = require('./errors');

// Cifrado de la API key de la IA guardada en Configuración (tabla settings).
// AES-256-GCM con una clave maestra que solo vive en el .env del servidor
// (IA_SECRET_KEY): la BD nunca tiene la key en claro.
function claveMaestra(env) {
    if (!env.IA_SECRET_KEY) {
        throw iaError('Falta IA_SECRET_KEY en el .env del servidor: no se puede guardar ni leer la API key de la IA');
    }
    return crypto.createHash('sha256').update(env.IA_SECRET_KEY).digest();
}

function cifrar(texto, env = process.env) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', claveMaestra(env), iv);
    const data = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

function descifrar(obj, env = process.env) {
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', claveMaestra(env), Buffer.from(obj.iv, 'base64'));
        decipher.setAuthTag(Buffer.from(obj.tag, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(obj.data, 'base64')), decipher.final()]).toString('utf8');
    } catch (e) {
        if (e.status) throw e;
        throw iaError('No se pudo leer la API key guardada (¿cambió IA_SECRET_KEY?). Vuelve a ingresarla en Configuración');
    }
}

module.exports = { cifrar, descifrar };
