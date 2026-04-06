const { z } = require("zod");

const userCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["viewer", "analyst", "admin"]),
  status: z.enum(["active", "inactive"]).default("active")
});

const userUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).max(128).optional(),
    role: z.enum(["viewer", "analyst", "admin"]).optional(),
    status: z.enum(["active", "inactive"]).optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided"
  });

const recordCreateSchema = z.object({
  amount: z.number().nonnegative(),
  type: z.enum(["income", "expense"]),
  category: z.string().trim().min(1).max(60),
  date: z.string().date(),
  notes: z.string().max(500).optional().nullable()
});

const recordUpdateSchema = z
  .object({
    amount: z.number().nonnegative().optional(),
    type: z.enum(["income", "expense"]).optional(),
    category: z.string().trim().min(1).max(60).optional(),
    date: z.string().date().optional(),
    notes: z.string().max(500).optional().nullable()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided"
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    req.validatedBody = parsed.data;
    return next();
  };
}

module.exports = {
  userCreateSchema,
  userUpdateSchema,
  recordCreateSchema,
  recordUpdateSchema,
  loginSchema,
  validateBody
};
