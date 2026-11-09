/** Tracks the largest layout-shift session: gaps under 1s and duration under 5s. */
export function createClsTracker() {
  let first = 0;
  let last = 0;
  let session = 0;
  let maximum = 0;
  return {
    add(startTime: number, value: number, hadRecentInput: boolean) {
      if (hadRecentInput) return;
      if (session > 0 && startTime - last < 1000 && startTime - first < 5000) {
        session += value;
      } else {
        first = startTime;
        session = value;
      }
      last = startTime;
      maximum = Math.max(maximum, session);
    },
    value() {
      return maximum;
    },
  };
}
