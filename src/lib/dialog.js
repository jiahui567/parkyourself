// The rules behind the app's own dialog (src/components/Dialog.js), which
// replaced Android's Alert on 2026-10-26.

// How long a dialog ignores taps on its buttons after it appears. One answer
// can open the next dialog in the same sheet with a button in the same spot
// (Delete account, then Delete account to confirm), and a quick second tap
// must not answer a question the user never saw.
export const DIALOG_TAP_DELAY_MS = 400;

// Whether a tap at nowMs on a dialog shown at shownAtMs counts. A clock that
// went back counts it, rather than ignoring taps until it catches up.
export function acceptsTap(shownAtMs, nowMs) {
  return nowMs < shownAtMs || nowMs - shownAtMs >= DIALOG_TAP_DELAY_MS;
}

// The queue with dialog added at the end, as a copy so each call is its own
// dialog. The same question asked again while it waits (a quick second tap on
// Delete) is not queued twice: its second copy would show after the first had
// been answered.
export function queueDialog(queue, dialog) {
  const last = queue[queue.length - 1];
  if (last && last.title === dialog.title && last.message === dialog.message) return queue;
  return [...queue, { ...dialog }];
}

// The queue once dialog, the one showing, is answered. Unchanged when dialog
// is no longer first (a second tap before the sheet went), so the next
// dialog is never closed by mistake.
export function unqueueDialog(queue, dialog) {
  return queue[0] === dialog ? queue.slice(1) : queue;
}

const OK = [{ text: 'OK' }];

// The buttons as the sheet stacks them, top to bottom, each with the Button
// variant to draw it in: the caller's order, but a 'cancel' button always
// last. The first other button is the main one: 'primary', or 'danger' when
// it is destructive. No buttons is a message with OK.
export function dialogButtons(buttons) {
  const list = buttons?.length ? buttons : OK;
  const actions = list.filter((button) => button.style !== 'cancel');
  const cancels = list.filter((button) => button.style === 'cancel');
  return [
    ...actions.map((button, index) => ({
      ...button,
      variant: button.style === 'destructive' ? 'danger' : index === 0 ? 'primary' : 'secondary',
    })),
    ...cancels.map((button) => ({ ...button, variant: 'secondary' })),
  ];
}

// The button a tap above the sheet or Back counts as: the cancel button, or
// the only button of a message. null when there is neither, so dismissing
// picks nothing.
export function dismissButton(buttons) {
  const list = buttons?.length ? buttons : OK;
  return list.find((button) => button.style === 'cancel') ?? (list.length === 1 ? list[0] : null);
}
