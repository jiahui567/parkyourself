// Level and bay suggestions from the text OCR reads off a pillar sign
// (PLAN.md, "OCR for the pillar sign"). The Park screen shows every candidate
// as a chip and the user picks, so this suggests generously rather than guessing.

const LEVEL = /^(?:[BP][1-9]|L(?:[1-9]|1[0-9]|20)|LG|UG|LL|G|M)$/;
const LETTER = /^[A-Z]$/;
const NUMBER = /^\d{1,4}$/;
const LETTER_NUMBER = /^[A-Z]\d{1,3}$/;

// pillarCandidates('LEVEL B2 ZONE C-14') -> { levels: ['B2'], bays: ['C14'] }
export function pillarCandidates(text) {
  const tokens = String(text ?? '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const levels = [];
  const bays = [];
  const add = (list, value) => {
    if (!list.includes(value)) list.push(value);
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];

    // "B 2", "C 14" and "C-14" arrive as a letter followed by a number.
    if (LETTER.test(token) && next !== undefined && NUMBER.test(next)) {
      const joined = token + next;
      if (LEVEL.test(joined)) {
        add(levels, joined);
      } else {
        if (LEVEL.test(token)) add(levels, token); // "M 12": level M, or bay M12
        add(bays, joined);
      }
      i++;
    } else if (LEVEL.test(token)) {
      add(levels, token);
    } else if (LETTER_NUMBER.test(token) || NUMBER.test(token)) {
      add(bays, token);
    }
  }
  return { levels, bays };
}

const hasAny = ({ levels, bays }) => levels.length > 0 || bays.length > 0;

// The suggestions Park shows: from the first photo whose text gives any. texts
// holds each photo's OCR text in order, null for a photo that was not read.
// Only the first photo is read, and the next only when the ones before gave
// nothing (PLAN.md, "Decisions made", Pillar photo).
export function suggestionsFromPhotos(texts) {
  for (const text of texts) {
    if (text == null) continue;
    const candidates = pillarCandidates(text);
    if (hasAny(candidates)) return candidates;
  }
  return { levels: [], bays: [] };
}

// Whether the next photo taken should be read.
export function shouldReadNextPhoto(texts) {
  return !hasAny(suggestionsFromPhotos(texts));
}
