import { randomUUID } from "crypto";

export function makeId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

