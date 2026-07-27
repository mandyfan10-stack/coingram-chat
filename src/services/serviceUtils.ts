/** Safe ISO conversion for Date or already-string timestamps. */
export const toISO = (date: Date | string | null | undefined): string | null | undefined => (
  date instanceof Date ? date.toISOString() : date
);
