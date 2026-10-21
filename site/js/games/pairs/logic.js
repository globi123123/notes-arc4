/** Pure deck logic for Pairs. */

export const SIZES = {
  '4x3': { label: 'Small', cols: 4, rows: 3 },
  '4x4': { label: 'Medium', cols: 4, rows: 4 },
  '6x6': { label: 'Large', cols: 6, rows: 6 },
};

/** Builds a shuffled deck of `pairs` pairs: [{ id, symbol }]. */
export function createDeck(pairs, symbolCount, rng = Math.random) {
  if (pairs > symbolCount) throw new Error('Not enough symbols for this board');
  const symbols = Array.from({ length: symbolCount }, (_, i) => i);
  // Pick which symbols appear this round.
  for (let i = symbols.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
  }
  const chosen = symbols.slice(0, pairs);
  const deck = [...chosen, ...chosen].map((symbol, id) => ({ id, symbol }));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export const isMatch = (a, b) => a.id !== b.id && a.symbol === b.symbol;
