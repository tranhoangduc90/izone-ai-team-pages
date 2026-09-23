// Ký một yêu cầu bằng HMAC SHA-256; mã truy cập không đi vào body hoặc URL.
export async function signedBody(docs, accessKey, now = Date.now(), randomId = () => crypto.randomUUID()) {
  if (!accessKey || typeof accessKey !== 'string') throw new Error('Nhập mã truy cập nội bộ.');
  const timestamp = now;
  const nonce = randomId();
  const canonical = String(timestamp) + '\n' + nonce + '\n' + JSON.stringify(docs);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(accessKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
  const signature = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return JSON.stringify({ timestamp, nonce, docs, signature });
}
