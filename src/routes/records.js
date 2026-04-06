const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/rbac");
const {
  recordCreateSchema,
  recordUpdateSchema,
  validateBody
} = require("../validators");

const router = express.Router();

function parseId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return { error: `${label} must be a positive integer` };
  }
  return { id };
}

router.get("/", requireRole("analyst", "admin"), (req, res) => {
  const { type, category, startDate, endDate } = req.query;
  const db = getDb();

  const where = [];
  const params = [];

  if (type) {
    if (!["income", "expense"].includes(type)) {
      return res.status(400).json({ message: "type must be income or expense" });
    }
    where.push("type = ?");
    params.push(type);
  }

  if (category) {
    where.push("category = ?");
    params.push(category);
  }

  if (startDate) {
    where.push("date >= ?");
    params.push(startDate);
  }

  if (endDate) {
    where.push("date <= ?");
    params.push(endDate);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const query = `
    SELECT
      id,
      amount,
      type,
      category,
      date,
      notes,
      created_by,
      created_at,
      updated_at
    FROM financial_records
    ${whereClause}
    ORDER BY date DESC, id DESC
  `;

  const records = db.prepare(query).all(...params);
  return res.json({ records });
});

router.get("/:id", requireRole("analyst", "admin"), (req, res) => {
  const parsed = parseId(req.params.id, "record id");
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }

  const db = getDb();
  const record = db
    .prepare(
      `SELECT id, amount, type, category, date, notes, created_by, created_at, updated_at
       FROM financial_records WHERE id = ?`
    )
    .get(parsed.id);

  if (!record) {
    return res.status(404).json({ message: "Record not found" });
  }

  return res.json({ record });
});

router.post(
  "/",
  requireRole("admin"),
  validateBody(recordCreateSchema),
  (req, res) => {
    const db = getDb();
    const { amount, type, category, date, notes } = req.validatedBody;

    const result = db
      .prepare(
        `INSERT INTO financial_records (amount, type, category, date, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(amount, type, category, date, notes ?? null, req.user.id);

    const record = db
      .prepare(
        `SELECT id, amount, type, category, date, notes, created_by, created_at, updated_at
         FROM financial_records WHERE id = ?`
      )
      .get(result.lastInsertRowid);

    return res.status(201).json({ record });
  }
);

router.patch(
  "/:id",
  requireRole("admin"),
  validateBody(recordUpdateSchema),
  (req, res) => {
    const parsed = parseId(req.params.id, "record id");
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM financial_records WHERE id = ?")
      .get(parsed.id);

    if (!existing) {
      return res.status(404).json({ message: "Record not found" });
    }

    const updates = req.validatedBody;
    const fields = Object.keys(updates);
    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const values = fields.map((field) => updates[field]);

    db.prepare(
      `UPDATE financial_records
       SET ${setClause}, updated_at = datetime('now')
       WHERE id = ?`
    ).run(...values, parsed.id);

    const record = db
      .prepare(
        `SELECT id, amount, type, category, date, notes, created_by, created_at, updated_at
         FROM financial_records WHERE id = ?`
      )
      .get(parsed.id);

    return res.json({ record });
  }
);

router.delete("/:id", requireRole("admin"), (req, res) => {
  const parsed = parseId(req.params.id, "record id");
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }

  const db = getDb();
  const result = db
    .prepare("DELETE FROM financial_records WHERE id = ?")
    .run(parsed.id);

  if (result.changes === 0) {
    return res.status(404).json({ message: "Record not found" });
  }

  return res.status(204).send();
});

module.exports = router;
