export function isUniqueConstraintError(error) {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  const errno = Number(error?.errno);
  return (
    msg.includes("UNIQUE constraint failed") ||
    msg.includes("constraint failed") ||
    msg.includes("Duplicate entry") ||
    code === "ER_DUP_ENTRY" ||
    errno === 1062
  );
}

