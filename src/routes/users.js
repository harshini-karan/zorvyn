const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/rbac");
const {
  userCreateSchema,
  userUpdateSchema,
  validateBody
} = require("../validators");

const router = express.Router();

router.get("/", requireRole("admin"), (req, res) => {
  const db = getDb();
  const users = db
    .prepare(
      "SELECT id, name, email, role, status, created_at FROM users ORDER BY id ASC"
    )
    .all();

  return res.json({ users });
});

router.get("/:id", requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const db = getDb();
  const user = db
    .prepare("SELECT id, name, email, role, status, created_at FROM users WHERE id = ?")
    .get(id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({ user });
});

router.post("/", requireRole("admin"), validateBody(userCreateSchema), (req, res) => {
  const db = getDb();
  const { name, email, password, role, status } = req.validatedBody;
  const passwordHash = bcrypt.hashSync(password, 10);

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ message: "Email already exists" });
  }

  const result = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)"
    )
    .run(name, email, passwordHash, role, status);

  const user = db
    .prepare("SELECT id, name, email, role, status, created_at FROM users WHERE id = ?")
    .get(result.lastInsertRowid);

  return res.status(201).json({ user });
});

router.patch(
  "/:id",
  requireRole("admin"),
  validateBody(userUpdateSchema),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const db = getDb();
    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    const updates = req.validatedBody;
    if (updates.email) {
      const duplicate = db
        .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
        .get(updates.email, id);

      if (duplicate) {
        return res.status(409).json({ message: "Email already exists" });
      }
    }

    const fields = Object.keys(updates);
    const setClause = fields
      .map((field) => (field === "password" ? "password_hash = ?" : `${field} = ?`))
      .join(", ");
    const values = fields.map((field) => {
      if (field === "password") {
        return bcrypt.hashSync(updates[field], 10);
      }
      return updates[field];
    });

    db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...values, id);

    const user = db
      .prepare("SELECT id, name, email, role, status, created_at FROM users WHERE id = ?")
      .get(id);

    return res.json({ user });
  }
);

router.delete("/:id", requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  if (id === req.user.id) {
    return res.status(400).json({ message: "Admin cannot delete their own user" });
  }

  const db = getDb();
  const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!exists) {
    return res.status(404).json({ message: "User not found" });
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return res.status(204).send();
});

module.exports = router;
