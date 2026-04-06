const express = require("express");
const bcrypt = require("bcryptjs");

const { getDb } = require("../db");
const { signAccessToken } = require("../token");
const { loginSchema, validateBody } = require("../validators");

const router = express.Router();

router.get("/", (req, res) => {
  return res.json({
    message: "Auth route is available",
    usage: {
      method: "POST",
      path: "/auth/login",
      contentType: "application/json",
      body: {
        email: "admin@finance.local",
        password: "Admin@123"
      }
    }
  });
});

router.get("/login", (req, res) => {
  return res.status(405).json({
    message: "Use POST /auth/login with JSON body (email, password)"
  });
});

router.post("/login", validateBody(loginSchema), (req, res) => {
  const { email, password } = req.validatedBody;
  const db = getDb();

  const user = db
    .prepare(
      "SELECT id, name, email, password_hash, role, status FROM users WHERE email = ?"
    )
    .get(email);

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (user.status !== "active") {
    return res.status(403).json({ message: "Inactive users cannot log in" });
  }

  const passwordMatches = bcrypt.compareSync(password, user.password_hash || "");
  if (!passwordMatches) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const accessToken = signAccessToken(user);

  return res.json({
    accessToken,
    tokenType: "Bearer",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    }
  });
});

module.exports = router;
