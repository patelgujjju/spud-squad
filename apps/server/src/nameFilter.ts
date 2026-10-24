// Prototype denylist, including Hindi and common Romanized forms. Check words
// and joined spellings so spacing, punctuation and simple substitutions fail.
const blocked = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'chutiya',
  'chutia',
  'bhenchod',
  'behenchod',
  'madarchod',
  'gaand',
  'चूतिया',
  'चुतिया',
  'बहनचोद',
  'मादरचोद',
  'गांड',
];
export function allowedName(name: string): boolean {
  const normalized = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/[^\p{L}\p{M}]/gu, '');
  return !blocked.some((word) => normalized.includes(word));
}
