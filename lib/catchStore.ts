import type { CatchResult } from './types';

// Simple module-level store for passing catch result from camera to result screen
let pendingCatch: CatchResult | null = null;

export function setPendingCatch(c: CatchResult): void {
  pendingCatch = c;
}

export function getPendingCatch(): CatchResult | null {
  return pendingCatch;
}

export function clearPendingCatch(): void {
  pendingCatch = null;
}
