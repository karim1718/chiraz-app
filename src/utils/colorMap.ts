/** Map color names to hex for filter pastilles */
export const colorNameToHex: Record<string, string> = {
  Noir: '#1a1a1a',
  Marron: '#5c4033',
  Cognac: '#9a5b2f',
  'Blanc cassé': '#f5f5dc',
  Gris: '#808080',
  Blanc: '#ffffff',
  Beige: '#E4E1D5',
  Bordeaux: '#722f37',
  Crème: '#fffdd0',
  Nude: '#e3c6a8',
  Rouge: '#c41e3a',
  Or: '#ffd700',
  Argent: '#c0c0c0',
  'Bleu marine': '#000080',
};

export function getHexForColor(name: string): string {
  return colorNameToHex[name] ?? '#888';
}
