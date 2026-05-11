/**
 * Application-wide date and time format constants
 */

export const DATE_FORMAT = "MM/DD/YYYY";
export const DATETIME_FORMAT = "MM/DD/YYYY HH:MM:SS Timezone";

/**
 * Format options for different date/time displays
 */
export const dateFormatOptions: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
};

export const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short",
};

/**
 * Utility functions for formatting dates
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", dateFormatOptions);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", dateTimeFormatOptions);
}

export function formatDateTimeInZone(date: Date | string, timeZone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", { ...dateTimeFormatOptions, timeZone });
}

/**
 * Format ISO date string to display format
 */
export function formatISODate(isoString: string): string {
  try {
    return formatDate(new Date(isoString));
  } catch {
    return isoString;
  }
}

/**
 * Format ISO datetime string to display format
 */
export function formatISODateTime(isoString: string): string {
  try {
    return formatDateTime(new Date(isoString));
  } catch {
    return isoString;
  }
}
