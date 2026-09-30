import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanTitle(title: string): string {
  if (!title) return '';
  
  // Basic cleaning by splitting common separators
  const parts = title.split(/[([|]| - |: /);
  
  // If we have a colon and the first part is short, it might be a prefix
  if (title.includes(': ')) {
    const colonParts = title.split(': ');
    if (colonParts[0].length < 15) {
      return cleanTitle(colonParts[1]);
    }
  }

  let cleaned = parts[0];
  
  // Fallback if split fails or returns empty
  if (!cleaned || cleaned.trim().length < 2) {
    cleaned = title;
  }

  return cleaned.trim();
}
