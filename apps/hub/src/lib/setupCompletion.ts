export const SETUP_COMPLETED_STORAGE_KEY = "btv.setup.completed";
export const SETUP_COMPLETED_EVENT = "btv:setup-completed";

export function readSetupCompleted(): boolean {
  try {
    return window.localStorage.getItem(SETUP_COMPLETED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeSetupCompleted(completed: boolean): void {
  try {
    window.localStorage.setItem(SETUP_COMPLETED_STORAGE_KEY, completed ? "true" : "false");
    window.dispatchEvent(new CustomEvent(SETUP_COMPLETED_EVENT, { detail: { completed } }));
  } catch {
    /* Local storage can be unavailable in restricted browser contexts. */
  }
}
