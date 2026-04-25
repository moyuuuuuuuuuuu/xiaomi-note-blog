const ACCESS_SESSION_PREFIX = 'xiaominote-access-auth:';

function getStorage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function getAccessSessionKey(password) {
  return `${ACCESS_SESSION_PREFIX}${String(password)}`;
}

export function isAccessPasswordAuthenticated(password) {
  if (!password) return true;
  const storage = getStorage();
  return storage?.getItem(getAccessSessionKey(password)) === '1';
}

export function markAccessPasswordAuthenticated(password) {
  if (!password) return;
  const storage = getStorage();
  storage?.setItem(getAccessSessionKey(password), '1');
}
