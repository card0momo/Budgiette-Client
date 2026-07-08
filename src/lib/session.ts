export type Session = {
  token: string | null;
  userId: number | null;
};

let current: Session = { token: null, userId: null };
let unauthorizedHandler: (() => void) | null = null;

export function getSession(): Session {
  return current;
}

export function setSession(next: Session) {
  current = next;
}

export function clearSession() {
  current = { token: null, userId: null };
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized() {
  unauthorizedHandler?.();
}
