/**
 * Library categories, in display order. "all" and "favorites" are virtual
 * categories; every other id must match a value used in game metadata.
 */
export const categories = [
  { id: 'all', label: 'All Games', icon: 'library', description: 'Every game in the library.' },
  { id: 'classics', label: 'Classics', icon: 'layers', description: 'Timeless games, rebuilt with care.' },
  { id: 'arcade', label: 'Arcade', icon: 'bolt', description: 'Quick reflexes, short rounds, one more try.' },
  { id: 'brain', label: 'Brain / Chill', icon: 'leaf', description: 'Puzzles and calm challenges at your own pace.' },
  { id: 'racing', label: 'Racing', icon: 'speed', description: 'Speed, traffic and tight lines.' },
  { id: 'favorites', label: 'Favorites', icon: 'heart', description: 'The games you have saved for later.' },
];

export const categoryById = (id) => categories.find((category) => category.id === id);

export const categoryLabel = (id) => categoryById(id)?.label ?? id;
