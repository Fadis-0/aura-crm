"use client";

import { useState } from "react";

/**
 * Local state seeded from a server prop, that re-seeds when the server sends
 * new data.
 *
 * Plain `useState(initial)` ignores every later value of `initial`, so after
 * `router.refresh()` the page kept showing the list it had at mount and a new
 * record only appeared on a hard reload. This adjusts during render, which is
 * React's sanctioned way to reset state when a prop changes — no effect, no
 * extra paint.
 */
export function useServerState<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const [seed, setSeed] = useState(initial);

  if (seed !== initial) {
    setSeed(initial);
    setValue(initial);
  }

  return [value, setValue] as const;
}
