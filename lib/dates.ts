const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseIsoDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const parsed = parseIsoDate(date);
  return toIsoDate(new Date(parsed.getTime() + days * MS_PER_DAY));
}

function addMonths(date: string, months: number) {
  const parsed = parseIsoDate(date);
  const day = parsed.getUTCDate();
  parsed.setUTCMonth(parsed.getUTCMonth() + months);

  // If the target month is shorter, JavaScript overflows. Correct it by using the last day of the previous month.
  if (parsed.getUTCDate() !== day) {
    parsed.setUTCDate(0);
  }

  return toIsoDate(parsed);
}

export function getNextDueDate(currentDueDate: string | null, frequency: string) {
  const baseDate = currentDueDate || todayIsoDate();

  if (frequency === "daily") {
    return addDays(baseDate, 1);
  }

  if (frequency === "weekly") {
    return addDays(baseDate, 7);
  }

  if (frequency === "monthly") {
    return addMonths(baseDate, 1);
  }

  return currentDueDate;
}
