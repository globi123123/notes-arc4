/** Reduced-motion preference, read live so changes apply immediately. */
const query =
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

export const prefersReducedMotion = () => Boolean(query && query.matches);

export const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(hover: none) and (pointer: coarse)').matches
    : false;
