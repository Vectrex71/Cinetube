import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanTitle(title: string): string {
  if (!title) return '';

  let cleaned = title.trim();

  // Strip common file extensions
  cleaned = cleaned.replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v)$/i, '');

  // Strip leading numbering/index often found in file playlists: e.g. "01 - ", "01. ", "001 ", "#1 "
  cleaned = cleaned.replace(/^#?\d+[\.\-_/:\s]+\s*/, '');

  // Replace underscores with spaces
  if (cleaned.includes('_')) {
    cleaned = cleaned.replace(/_/g, ' ');
  }

  // Handle common prefixes with colon e.g. "Film: Der Pate" or "Spielfilm: Inception"
  if (cleaned.includes(': ')) {
    const colonParts = cleaned.split(': ');
    if (colonParts[0].length < 15) {
      return cleanTitle(colonParts.slice(1).join(': '));
    }
  }

  // Split at common delimiter patterns like (1985), [HD], | Deutsch, - Ganzer Film
  const parts = cleaned.split(/[([|]| - /);
  let candidate = parts[0]?.trim();

  // Fallback if split fails or returns too short
  if (!candidate || candidate.length < 2) {
    candidate = cleaned;
  }

  return candidate.trim();
}

