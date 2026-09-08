import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper `cn` : fusionne des classes Tailwind en gérant les conflis
// (twMerge garde la dernière classe gagnante pour une même propriété).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
