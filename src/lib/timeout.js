// Time limits for calls to the server: React Native's fetch never gives up on
// its own, and on a weak signal in a basement a request can hang for minutes.

// promise, or a rejection with Error(message) once ms pass first. The work
// behind promise keeps running; only the wait ends.
export function withTimeout(promise, ms, message) {
  let timer;
  const late = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

// Whether promise settles within ms, for waiting on work that keeps its own
// result and errors (the sync does): true once it has, false when ms pass
// first. The work keeps running either way.
export function settlesWithin(promise, ms) {
  let timer;
  const late = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  const settled = promise.then(
    () => true,
    () => true
  );
  return Promise.race([settled, late]).finally(() => clearTimeout(timer));
}
