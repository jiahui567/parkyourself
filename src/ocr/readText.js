import { recognizeText } from 'expo-mlkit-ocr';

// The only code that calls the OCR library: Google ML Kit's Latin text model,
// bundled with the app, so the text is read on the phone and no model is
// downloaded. ML Kit itself may send Google usage metrics (PLAN.md, "OCR for
// the pillar sign"). Returns { text, lines } for a photo file: the text ('' when
// there is none), and each line with its box in the photo's pixels
// ({ text, box: { x, y, width, height } }), so pillarText.js can tell the big
// sign from a car plate or an ad beside it.
export async function readPhotoText(uri) {
  const { text, blocks } = await recognizeText(uri);
  // A line with no box arrives as {} on Android.
  const boxOf = (line) => (line.boundingBox?.height > 0 ? line.boundingBox : null);
  const lines = (blocks ?? []).flatMap((block) =>
    (block.lines ?? []).map((line) => ({ text: line.text, box: boxOf(line) }))
  );
  return { text: text ?? '', lines };
}
