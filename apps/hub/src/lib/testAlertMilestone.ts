export const FIRST_TEST_ALERT_STORAGE_KEY = "btv.first-test-alert.seen";
export const TEST_ALERT_SUCCESS_EVENT = "btv:test-alert-success";

export function hasSeenFirstTestAlert(): boolean {
  try {
    return window.localStorage.getItem(FIRST_TEST_ALERT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markFirstTestAlertSeen(): void {
  try {
    window.localStorage.setItem(FIRST_TEST_ALERT_STORAGE_KEY, "true");
  } catch {
    /* Local storage can be unavailable in restricted browser contexts. */
  }
}

export function emitTestAlertSuccess(eventType: string): void {
  window.dispatchEvent(new CustomEvent(TEST_ALERT_SUCCESS_EVENT, { detail: { eventType } }));
}
