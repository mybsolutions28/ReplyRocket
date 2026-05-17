// AES-256-GCM helpers for at-rest encryption of customer-supplied secrets
// (Razorpay key secret, future SMTP passwords, etc).
// We derive a 32-byte key from APP_SECRETS_KEY (any string) using sha256.
// Format stored in DB: base64(iv || authTag || ciphertext)

import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey() {
  const seed = process.env.APP_SECRETS_KEY || process.env.JWT_SECRET
  if (!seed) {
    throw new Error('APP_SECRETS_KEY (or JWT_SECRET fallback) is required to encrypt/decrypt secrets')
  }
  return crypto.createHash('sha256').update(seed).digest()
}

export function encryptSecret(plaintext) {
  if (plaintext === undefined || plaintext === null || plaintext === '') return ''
  const key = getKey()
  const iv = crypto.randomBytes(12) // GCM standard 96-bit IV
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decryptSecret(encoded) {
  if (!encoded || typeof encoded !== 'string') return ''
  try {
    const buf = Buffer.from(encoded, 'base64')
    if (buf.length < 12 + 16 + 1) return ''
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const ct = buf.subarray(28)
    const key = getKey()
    const decipher = crypto.createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])
    return pt.toString('utf8')
  } catch (e) {
    console.error('decryptSecret failed:', e.message)
    return ''
  }
}

// Render a secret as "rzp_test_••••••XYZ" for safe display in the UI.
export function maskSecret(s, visibleSuffix = 4) {
  if (!s) return ''
  const str = String(s)
  if (str.length <= visibleSuffix) return '•'.repeat(str.length)
  return str.slice(0, 8) + '••••••' + str.slice(-visibleSuffix)
}
