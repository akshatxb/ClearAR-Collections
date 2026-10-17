/**
 * Centralized currency formatting utility for ClearAR Collections.
 */

/**
 * Formats a numeric value to USD currency formatted to 0 fraction digits (whole dollars).
 * e.g., 1234.56 -> "$1,235"
 */
export const money = (v) =>
  Number(v || 0).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

/**
 * Formats a numeric value to USD currency formatted with exact 2 fraction digits (cents).
 * e.g., 1234.5 -> "$1,234.50"
 */
export const moneyExact = (v) =>
  Number(v || 0).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
