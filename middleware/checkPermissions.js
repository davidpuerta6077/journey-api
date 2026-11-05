const postgresql = require('../database/postgresql');

// submoduleCode: un código o una lista de códigos (basta con tener uno).
function checkPermission(submoduleCode) {
  console.log("Submodule code:", submoduleCode);
  return async (req, res, next) => {
    try {
      const email = req.user.email; 
      console.log("Email del usuario:", email);
      const result = await postgresql.checkSubmodulesPermissionsData(email, submoduleCode);

      // Sin fila = el rol no tiene ninguno de los submódulos pedidos.
      if (!result.length) {
        return res.status(403).json({ message: "No tienes permiso para este recurso" });
      }

      next();
      
    } catch (error) {
      return res.status(500).json({ message: "Error validando permisos" });
    }
  };
}

module.exports = checkPermission;