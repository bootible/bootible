// Shared auth primitives used by the welcome / sync-key / 2FA steps: the cloud IPC
// handle and a busy-button wrapper.
export const cloud = window.bootible?.cloud;

/** Disable a button + show a spinner while an async action runs, then restore. */
export async function withBusy<T>(
  btn: HTMLButtonElement | null | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (btn) {
    btn.disabled = true;
    btn.classList.add("busy");
  }
  try {
    return await fn();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("busy");
    }
  }
}
