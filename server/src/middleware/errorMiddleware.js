import { isHttpError } from "../utils/httpErrors.js";

export function errorMiddleware(error, req, res, next) {
  if (res.headersSent) return next(error);

  const isJsonParseError =
    error?.type === "entity.parse.failed" ||
    (error instanceof SyntaxError && "body" in error);
  if (isJsonParseError) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const isProd = process.env.NODE_ENV === "production";
  const status = isHttpError(error) ? error.status : 500;

  const message = isHttpError(error)
    ? error.message
    : isProd
      ? "Internal Server Error"
      : error?.message || "Internal Server Error";

  const payload = { error: message };

  if (isHttpError(error) && error.code) payload.code = error.code;
  if (isHttpError(error) && error.details !== undefined) {
    payload.details = error.details;
  }

  res.status(status).json(payload);
}
