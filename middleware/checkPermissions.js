import postgresql from '../database/postgresql';

function checkPermission(submoduleCode) {
  return async (req, res, next) => {
    try {
      const email = req.user.email; 

      const result = await postgresql.checkPermissionsData(email, submoduleCode);

      if (result.rows.length === 0) {
        return res.status(403).json({ message: "No tienes permiso para este recurso" });
      }

      next();
      
    } catch (error) {
      return res.status(500).json({ message: "Error validando permisos" });
    }
  };
}

module.exports = checkPermission;