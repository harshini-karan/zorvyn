const { getDb } = require("../db");
const { verifyAccessToken } = require("../token");

function authenticate(req, res, next) {
  const authorizationHeader = req.header("authorization") || "";
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      message: "Missing or invalid Authorization header"
    });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      message: "Token subject is invalid"
    });
  }

  const db = getDb();
  const user = db
    .prepare("SELECT id, name, email, role, status FROM users WHERE id = ?")
    .get(userId);

  if (!user) {
    return res.status(401).json({
      message: "User not found"
    });
  }

  if (user.status !== "active") {
    return res.status(403).json({
      message: "Inactive users cannot access this API"
    });
  }

  req.user = user;
  return next();
}

module.exports = {
  authenticate
};
