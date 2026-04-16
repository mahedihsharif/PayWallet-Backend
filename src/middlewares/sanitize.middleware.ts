import { NextFunction, Request, Response } from "express";
import mongoSanitize from "express-mongo-sanitize";

// ─── Defence 1: NoSQL Injection Prevention ────────────────────────
// Strips MongoDB operators ($, .) from user input
// Attack example: { "email": { "$gt": "" } } would match ALL users
// mongoSanitize replaces this with: { "email": { "_gt": "" } } — harmless

export const sanitizeInput = mongoSanitize({
  replaceWith: "_",
  onSanitize: ({ req, key }) => {
    // Log sanitisation events — could indicate a probe/attack
    console.warn(`Sanitized field '${key}' in request from ${req.ip}`);
  },
});

// ─── Defence 2: XSS Prevention (manual sanitiser) ────────────────
// Strip HTML tags from string fields before they reach the database
// Even though we use output encoding on the frontend, defence in depth

const stripHtml = (value: unknown): unknown => {
  if (typeof value === "string") {
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<[^>]+>/g, "") // Strip all HTML tags
      .trim();
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        stripHtml(v),
      ]),
    );
  }
  return value;
};

export const xssSanitize = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.body) req.body = stripHtml(req.body);
  if (req.query) req.query = stripHtml(req.query) as typeof req.query;
  next();
};
