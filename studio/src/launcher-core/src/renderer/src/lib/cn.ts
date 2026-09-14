import clsx, { type ClassValue } from 'clsx'

/** Conditional class names. Thin alias so components read cleanly. */
export function cn(...classes: ClassValue[]): string {
  return clsx(classes)
}
