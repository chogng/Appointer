export function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidTimeSlot(value) {
  return typeof value === "string" && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(value);
}

export function calculateDuration(timeSlot) {
  if (!timeSlot || !timeSlot.includes("-")) return 0;
  const [start, end] = timeSlot.split("-");
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  return endH * 60 + endM - (startH * 60 + startM);
}

