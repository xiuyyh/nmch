import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date explicitly in Nigeria/West Africa Time (WAT)
 */
export function formatNigeriaTime(date: Date | null | undefined, includeSeconds: boolean = false) {
  if (!date) return "N/A";
  
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
      timeZone: 'Africa/Lagos'
    }).format(date);
  } catch (e) {
    return date.toLocaleString();
  }
}
