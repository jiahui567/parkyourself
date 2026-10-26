import { acceptsTap, DIALOG_TAP_DELAY_MS, dialogButtons, dismissButton, queueDialog, unqueueDialog } from './dialog';

const cancel = { text: 'Cancel', style: 'cancel' };
const remove = { text: 'Delete', style: 'destructive' };

describe('dialogButtons', () => {
  it('puts Cancel last, whatever its place in the list', () => {
    const update = { text: 'Yes, update' };
    const once = { text: 'Only this time' };

    expect(dialogButtons([cancel, update, once]).map((button) => button.text)).toEqual([
      'Yes, update',
      'Only this time',
      'Cancel',
    ]);
  });

  it('draws the first button as the main one and the rest in grey', () => {
    const variants = dialogButtons([{ text: 'Use it' }, { text: 'No place' }, cancel]).map((b) => b.variant);

    expect(variants).toEqual(['primary', 'secondary', 'secondary']);
  });

  it('draws a destructive button in red', () => {
    expect(dialogButtons([remove, cancel]).map((button) => button.variant)).toEqual(['danger', 'secondary']);
  });

  it("keeps each button's onPress", () => {
    const onPress = jest.fn();

    dialogButtons([{ ...remove, onPress }])[0].onPress();

    expect(onPress).toHaveBeenCalled();
  });

  it('shows a message with OK when there are no buttons', () => {
    expect(dialogButtons(undefined)).toEqual([{ text: 'OK', variant: 'primary' }]);
    expect(dialogButtons([])).toEqual([{ text: 'OK', variant: 'primary' }]);
  });
});

describe('dismissButton', () => {
  it('counts a tap outside as Cancel', () => {
    expect(dismissButton([remove, cancel])).toBe(cancel);
  });

  it('counts it as the only button of a message', () => {
    const ok = { text: 'OK' };

    expect(dismissButton([ok])).toBe(ok);
    expect(dismissButton(undefined)).toEqual({ text: 'OK' });
  });

  it('picks nothing when there is no Cancel among several buttons', () => {
    expect(dismissButton([{ text: 'Yes' }, { text: 'No' }])).toBeNull();
  });
});

describe('queueDialog and unqueueDialog', () => {
  const stop = { title: 'Stop the timer?', message: 'Its reminders are cancelled.' };
  const sent = { title: 'Report sent', message: 'Thanks.' };

  it('queues dialogs in turn, each a copy', () => {
    const queue = queueDialog(queueDialog([], stop), sent);

    expect(queue).toEqual([stop, sent]);
    expect(queue[0]).not.toBe(stop);
  });

  it('does not queue the same question twice in a row', () => {
    const queue = queueDialog([], stop);

    expect(queueDialog(queue, { ...stop })).toBe(queue);
  });

  it('asks the same question again once the first is answered', () => {
    const queue = queueDialog([], stop);

    expect(queueDialog(unqueueDialog(queue, queue[0]), stop)).toEqual([stop]);
  });

  it('closes only the dialog showing', () => {
    const queue = queueDialog(queueDialog([], stop), sent);

    expect(unqueueDialog(queue, queue[0])).toEqual([sent]);
    expect(unqueueDialog(queue, queue[1])).toBe(queue);
  });
});

describe('acceptsTap', () => {
  const SHOWN = 1_000_000;

  it('ignores a tap that comes right after the dialog appears', () => {
    expect(acceptsTap(SHOWN, SHOWN)).toBe(false);
    expect(acceptsTap(SHOWN, SHOWN + DIALOG_TAP_DELAY_MS - 1)).toBe(false);
  });

  it('counts a tap once the dialog has been in sight a moment', () => {
    expect(acceptsTap(SHOWN, SHOWN + DIALOG_TAP_DELAY_MS)).toBe(true);
  });

  it('counts a tap when the clock went back', () => {
    expect(acceptsTap(SHOWN, SHOWN - 5000)).toBe(true);
  });
});
