import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const merge = extendTailwindMerge({
  extend: { theme: { text: ['heading', 'body', 'caption', 'label'] } },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
