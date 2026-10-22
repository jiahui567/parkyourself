import { recognizeText } from 'expo-mlkit-ocr';

// The only code that calls the OCR library: Google ML Kit's Latin text model,
// bundled with the app, so the text is read on the phone and no model is
// downloaded. ML Kit itself may send Google usage metrics (PLAN.md, "OCR for
// the pillar sign"). Returns the text of a photo file ('' when there is none);
// pillarText.js finds the level and bay in it.
export async function readPhotoText(uri) {
  const { text } = await recognizeText(uri);
  return text ?? '';
}
