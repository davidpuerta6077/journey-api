const verifier = require("./auth_aws");

async function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Authorization header missing or malformed:", authHeader);
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = await verifier.verify(token);
    console.log("Payload del token:", payload);
    req.user = {
      email: payload.email,
      sub: payload.sub,
    };
    next();
  } catch (err) {
    console.error("Error verifying token:", err);
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}

module.exports = checkAuth;