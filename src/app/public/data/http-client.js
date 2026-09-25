export async function apiRequest(path, options = {}) {
  const { request = fetch, body, headers = {}, ...rest } = options;
  const hasBody = body !== undefined;
  const response = await request(path, {
    credentials: 'same-origin',
    ...rest,
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...headers
    },
    ...(hasBody ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Falha HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function withQuery(path, filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null || value === '' || value === 'all') continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
