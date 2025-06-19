// Safe utility functions for handling nullable properties
export function safeString(value: string | null | undefined, defaultValue: string = ''): string {
  return value ?? defaultValue;
}

export function safeDate(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toISOString();
  } catch {
    return '';
  }
}

export function formatStatusText(status: string | null | undefined): string {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Safe type guards
export function isValidStatus(status: any): status is string {
  return typeof status === 'string' && status.length > 0;
}

export function isValidType(type: any): type is string {
  return typeof type === 'string' && type.length > 0;
}