const postgresql = require('../database/postgresql');

function checkPermission(submoduleCode) {
  console.log("Submodule code:", submoduleCode);
  return async (req, res, next) => {
    try {
      const email = req.user.email; 
      console.log("Email del usuario:", email);
      const result = await postgresql.checkSubmodulesPermissionsData(email, submoduleCode);

      if (result[0]['?column?'] === 0) {
        return res.status(403).json({ message: "No tienes permiso para este recurso" });
      }

      next();
      
    } catch (error) {
      return res.status(500).json({ message: "Error validando permisos" });
    }
  };
}

module.exports = checkPermission;