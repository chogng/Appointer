export class HttpError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    if (options.code) this.code = options.code;
    if (options.details !== undefined) this.details = options.details;
    if (options.cause) this.cause = options.cause;
  }
}

export function isHttpError(error) {
  return (
    error instanceof HttpError ||
    (Boolean(error) &&
      typeof error === "object" &&
      Number.isInteger(error.status) &&
      error.status >= 400 &&
      error.status < 600)
  );
}

export function httpError(status, message, options) {
  return new HttpError(status, message, options);
}

export function badRequest(message = "Bad Request", details) {
  return new HttpError(400, message, details === undefined ? {} : { details });
}

export function unauthorized(message = "Unauthorized", details) {
  return new HttpError(401, message, details === undefined ? {} : { details });
}

export function forbidden(message = "Forbidden", details) {
  return new HttpError(403, message, details === undefined ? {} : { details });
}

export function notFound(message = "Not Found", details) {
  return new HttpError(404, message, details === undefined ? {} : { details });
}

export function conflict(message = "Conflict", details) {
  return new HttpError(409, message, details === undefined ? {} : { details });
}
