/**
 * Site-wide settings. Change the name here to rebrand the whole site.
 * The brand renders as `name` followed by `mark` in the accent color.
 */
export const SITE = {
  name: 'playground',
  mark: '.',
  tagline: 'A little place to play.',
  description:
    'Small, carefully made games that run right in your browser. No installs and no accounts, just pick one and press play.',
  // Prefix for everything stored in localStorage.
  storageKey: 'playground',
};

export const siteTitle = () => `${SITE.name}${SITE.mark}`;
