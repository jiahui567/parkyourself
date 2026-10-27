import { settlesWithin, withTimeout } from './timeout';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

const never = () => new Promise(() => {});

describe('withTimeout', () => {
  it('gives the result when it comes in time', async () => {
    await expect(withTimeout(Promise.resolve('done'), 1000, 'Too slow')).resolves.toBe('done');
  });

  it('passes on an error that comes in time', async () => {
    await expect(withTimeout(Promise.reject(new Error('Refused')), 1000, 'Too slow')).rejects.toThrow('Refused');
  });

  it('fails with the message once the time is up', async () => {
    const waiting = withTimeout(never(), 1000, 'Too slow');
    jest.advanceTimersByTime(1000);

    await expect(waiting).rejects.toThrow('Too slow');
  });

  it('leaves no timer behind', async () => {
    await withTimeout(Promise.resolve('done'), 1000, 'Too slow');

    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('settlesWithin', () => {
  it('is true when the work ends in time, even with an error', async () => {
    await expect(settlesWithin(Promise.resolve(), 1000)).resolves.toBe(true);
    await expect(settlesWithin(Promise.reject(new Error('Refused')), 1000)).resolves.toBe(true);
  });

  it('is false once the time is up', async () => {
    const waiting = settlesWithin(never(), 1000);
    jest.advanceTimersByTime(1000);

    await expect(waiting).resolves.toBe(false);
  });
});
