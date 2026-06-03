const jwt = require('jsonwebtoken');
const config = require('../../config')
const secret = config.jwt.secret
const database = require('../../database/postgresql');
const table_permissions = config.table_permissions


function canAccessTable(table, userRoles = []) {
  const allowedRoles = table_permissions[table];
  if (!allowedRoles) return false;
  return userRoles.some((role) => allowedRoles.includes(role));
}

const verifyToken = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const token = req.params.token;

      if (!token) {
        return res.status(401).json({ error: "Token requerido" });
      }

      const decoded = jwt.verify(token, secret);
      const data = await database.itemByEmail("users", decoded.email);

      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const userRoles = Array.isArray(data[0].roles_id)
        ? data[0].roles_id
        : [data[0].roles_id];

      const hasPermission = userRoles.some((role) =>
        allowedRoles.includes(role)
      );

      if (!hasPermission) {
        return res
          .status(403)
          .json({ error: "No tienes permisos para realizar esta acción" });
      }

      req.user = decoded;
      next();
    } catch (err) {
      return res.status(403).json({ error: "Token inválido o expirado" });
    }
  };
};


module.exports = {
  verifyToken, 
  canAccessTable
};