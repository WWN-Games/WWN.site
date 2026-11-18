export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addMonthsIso(value: string, months: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || !Number.isInteger(months)) return value;
  const day = date.getUTCDate();
  // Переводим на первое число, чтобы 31 января + 1 месяц не стало 3 марта.
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const daysInMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, daysInMonth));
  return date.toISOString().slice(0, 10);
}

export function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}
