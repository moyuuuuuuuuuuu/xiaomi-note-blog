async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `请求失败：HTTP ${response.status}`);
  }
  return data;
}

export function fetchSettings() {
  return request('/api/settings');
}

export function saveSettings(settings) {
  return request('/api/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

export function fetchNotes() {
  return request('/api/notes');
}

export function fetchNote(noteId) {
  return request(`/api/notes/${encodeURIComponent(noteId)}`);
}

export function updateNote(note) {
  return request(`/api/notes/${encodeURIComponent(note.id)}`, {
    method: 'PUT',
    body: JSON.stringify(note),
  });
}

export function deleteNote(noteId) {
  return request(`/api/notes/${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
  });
}

export function syncNotes() {
  return request('/api/sync', { method: 'POST' });
}

export function fetchAdminSession() {
  return request('/api/admin/session');
}

export function loginAdmin(password) {
  return request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function saveMiCookie(cookie) {
  return request('/api/settings/mi-cookie', {
    method: 'POST',
    body: JSON.stringify({ cookie }),
  });
}

export function clearMiCookie() {
  return request('/api/settings/mi-cookie', {
    method: 'DELETE',
  });
}

export function verifyProtectedPassword({ scope, id, password }) {
  return request('/api/password/verify', {
    method: 'POST',
    body: JSON.stringify({ scope, id, password }),
  });
}
