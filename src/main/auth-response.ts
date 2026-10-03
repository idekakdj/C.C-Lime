/** Read provider JSON with a streaming limit, including responses without Content-Length. */
export async function authResponse(response: Response, limit = 131072): Promise<any> {
  if (Number(response.headers.get('content-length') ?? 0) > limit) {
    await response.body?.cancel(); throw new Error('The identity service returned an oversized response.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The identity service returned an empty response.');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new Error('The identity service returned an oversized response.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Error('The identity service returned an invalid response.'); }
}
