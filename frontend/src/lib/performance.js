export function runWhenIdle(callback, { timeout = 1200 } = {}) {
  if (typeof window === 'undefined') {
    callback();
    return () => undefined;
  }

  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback?.(idleId);
  }

  const timerId = window.setTimeout(callback, Math.min(timeout, 700));
  return () => window.clearTimeout(timerId);
}
