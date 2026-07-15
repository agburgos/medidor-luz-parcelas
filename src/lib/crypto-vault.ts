// Cifrado de extremo a extremo para la Bóveda de Claves, 100% en el navegador
// (Web Crypto API). El servidor solo almacena bytes cifrados: nunca ve la
// contraseña maestra, la "llave" de la bóveda, ni el contenido de los ítems.
//
// Esquema: cada bóveda tiene una "vault key" (AES-256-GCM) aleatoria, que
// cifra cada ítem. Esa vault key se protege ("envuelve") con una clave
// derivada de la contraseña maestra vía PBKDF2. El respaldo de recuperación
// usa la misma vault key envuelta de otra forma, en el servidor (ver
// lib/vaultRecovery.ts) — el navegador nunca conoce ese segundo envoltorio.

const PBKDF2_ITERACIONES = 310_000

function bufferABase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function base64ABuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

export function generarSaltB64(): string {
  return bufferABase64(crypto.getRandomValues(new Uint8Array(16)).buffer)
}

export function generarIvB64(): string {
  return bufferABase64(crypto.getRandomValues(new Uint8Array(12)).buffer)
}

// Deriva una clave AES-GCM (para envolver/desenvolver la vault key) a partir
// de la contraseña maestra + salt. No es exportable.
export async function derivarClaveDesdePassword(password: string, saltB64: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  // extractable=true: solo así podemos exportar sus bytes crudos en el flujo
  // de recuperación de acceso (ver desbloquearBoveda con propósito "recuperar").
  // No representa un riesgo adicional: el propio navegador ya tiene la
  // contraseña en memoria en ese momento.
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: base64ABuffer(saltB64), iterations: PBKDF2_ITERACIONES, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// Exporta los bytes crudos de una clave derivada (solo se usa durante la
// recuperación de acceso, para que el servidor pueda re-envolver la vault key).
export async function exportarClaveDerivadaB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return bufferABase64(raw)
}

// Genera la "vault key" aleatoria que cifra los ítems de una bóveda.
// Exportable porque necesitamos enviarla (una sola vez, al crear la bóveda)
// para que el servidor arme el respaldo de recuperación.
export async function generarVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportarVaultKeyB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return bufferABase64(raw)
}

export async function importarVaultKeyB64(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', base64ABuffer(rawB64), 'AES-GCM', true, ['encrypt', 'decrypt'])
}

// Envuelve (cifra) la vault key con la clave derivada de la contraseña maestra
export async function envolverVaultKey(vaultKey: CryptoKey, claveEnvoltura: CryptoKey, ivB64: string): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', vaultKey)
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: base64ABuffer(ivB64) }, claveEnvoltura, raw)
  return bufferABase64(cifrado)
}

// Desenvuelve (descifra) la vault key usando la clave derivada de la contraseña maestra
export async function desenvolverVaultKey(wrappedB64: string, claveEnvoltura: CryptoKey, ivB64: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ABuffer(ivB64) }, claveEnvoltura, base64ABuffer(wrappedB64))
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
}

export interface ItemDescifrado {
  titulo: string
  usuario?: string
  secreto: string
  notas?: string
  url?: string
}

// Cifra los datos de un ítem con la vault key (ya desbloqueada)
export async function cifrarItem(datos: ItemDescifrado, vaultKey: CryptoKey): Promise<{ iv: string; datos_cifrados: string }> {
  const iv = generarIvB64()
  const plano = new TextEncoder().encode(JSON.stringify(datos))
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: base64ABuffer(iv) }, vaultKey, plano)
  return { iv, datos_cifrados: bufferABase64(cifrado) }
}

export async function descifrarItem(datosCifradosB64: string, ivB64: string, vaultKey: CryptoKey): Promise<ItemDescifrado> {
  const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ABuffer(ivB64) }, vaultKey, base64ABuffer(datosCifradosB64))
  return JSON.parse(new TextDecoder().decode(plano))
}
