export function getXiaomiSyncCookie(settings = {}) {
  const miCookie = settings.miCookie?.trim();
  if (miCookie) return miCookie;

  const legacyCookie = settings.authCookie?.trim();
  if (!legacyCookie) return '';

  const looksLikeXiaomiCookie = /(?:^|;\s*)(serviceToken|userId|passToken|cUserId)=/.test(legacyCookie);
  return looksLikeXiaomiCookie ? legacyCookie : '';
}
