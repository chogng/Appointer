import { badRequest } from "./httpErrors.js";

export function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function requirePlainObject(value, name = "payload") {
  if (!isPlainObject(value)) {
    throw badRequest(`Invalid ${name} (expected JSON object)`);
  }
  return value;
}

export function requireString(
  value,
  name,
  { trim = true, minLength = 1, maxLength = 2048, pattern } = {},
) {
  if (typeof value !== "string") {
    throw badRequest(`${name} must be a string`);
  }
  const normalized = trim ? value.trim() : value;
  if (minLength > 0 && !normalized) {
    throw badRequest(`${name} is required`);
  }
  if (normalized.length < minLength) {
    throw badRequest(`${name} must be at least ${minLength} characters`);
  }
  if (normalized.length > maxLength) {
    throw badRequest(`${name} must be at most ${maxLength} characters`);
  }
  if (pattern && !pattern.test(normalized)) {
    throw badRequest(`Invalid ${name}`);
  }
  return normalized;
}

export function optionalString(value, name, options) {
  if (value === undefined || value === null) return undefined;
  return requireString(value, name, { minLength: 0, ...(options || {}) });
}

export function requireOneOf(value, name, allowedValues) {
  if (typeof value !== "string") {
    throw badRequest(`${name} must be a string`);
  }
  if (!allowedValues.includes(value)) {
    throw badRequest(`Invalid ${name}`);
  }
  return value;
}

export function requireInteger(
  value,
  name,
  { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {},
) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw badRequest(`${name} must be an integer`);
  }
  if (num < min || num > max) {
    throw badRequest(`${name} must be between ${min} and ${max}`);
  }
  return num;
}

export function optionalInteger(value, name, options) {
  if (value === undefined || value === null || value === "") return undefined;
  return requireInteger(value, name, options);
}

export function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function requireDateString(value, name = "date") {
  if (!isValidDateString(value)) {
    throw badRequest(`Invalid ${name} (expected YYYY-MM-DD)`);
  }
  return value;
}

export function requireNullableDateString(value, name = "date") {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return requireDateString(value, name);
}

export function isValidTimeSlot(value) {
  return typeof value === "string" && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(value);
}

export function requireTimeSlot(value, name = "timeSlot") {
  if (!isValidTimeSlot(value)) {
    throw badRequest(`Invalid ${name} (expected HH:MM-HH:MM)`);
  }
  return value;
}

export function assertAllowedKeys(input, allowedKeys) {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw badRequest(`Unknown fields: ${unknown.join(", ")}`);
  }
}
