// Envoltorio de recuperación de la Bóveda de Claves — SOLO se usa en el
// servidor. La clave de recuperación (derivada de VAULT_RECOVERY_SECRET,
// una variable de entorno que vive únicamente en Vercel/`.env.local`, nunca
// en la base de datos ni en el código) jamás se envía al navegador.
//
// Esto protege contra alguien con acceso solo a un volcado/respaldo de la
// base de datos. No protege contra quien ya controle el servidor en vivo o
// sus variables de entorno — ningún esquema de "respaldo recuperable" puede
// evitar eso.

function bufferABase64(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString('base64')
}

function base64ABuffer(b64: string): ArrayBuffer {
  const buf = Buffer.from(b64, 'base64')
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

async function claveRecuperacion(): Promise<CryptoKey> {
  const secreto = process.env.VAULT_RECOVERY_SECRET
  if (!secreto) throw new Error('VAULT_RECOVERY_SECRET no está configurado en el servidor')
  // SHA-256 del secreto -> 32 bytes exactos para AES-256
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secreto))
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export function recuperacionConfigurada(): boolean {
  return !!process.env.VAULT_RECOVERY_SECRET
}

export function generarIvB64Servidor(): string {
  return bufferABase64(crypto.getRandomValues(new Uint8Array(12)).buffer)
}

// Envuelve la vault key (bytes crudos, recién generada por el cliente durante
// el setup) con la clave de recuperación del servidor.
export async function envolverConRecovery(vaultKeyRawB64: string): Promise<{ iv: string; wrapped: string }> {
  const clave = await claveRecuperacion()
  const iv = generarIvB64Servidor()
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: base64ABuffer(iv) }, clave, base64ABuffer(vaultKeyRawB64))
  return { iv, wrapped: bufferABase64(cifrado) }
}

// Desenvuelve la vault key usando la clave de recuperación (paso 1 de la
// recuperación de acceso). El resultado vive solo en memoria del servidor
// durante esta misma request.
async function desenvolverConRecovery(wrappedB64: string, ivB64: string): Promise<ArrayBuffer> {
  const clave = await claveRecuperacion()
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ABuffer(ivB64) }, clave, base64ABuffer(wrappedB64))
}

// Recuperación completa: desenvuelve la vault key con la clave de recuperación
// y la vuelve a envolver con la NUEVA clave derivada de la nueva contraseña
// maestra (que el cliente ya derivó localmente y envía solo esta vez, para
// esta operación puntual). Devuelve el nuevo envoltorio a guardar.
export async function reenvolverParaRecuperacion(
  wrappedRecoveryB64: string,
  ivRecoveryB64: string,
  nuevaClaveDerivadaRawB64: string,
  nuevoIvB64: string
): Promise<string> {
  const vaultKeyRaw = await desenvolverConRecovery(wrappedRecoveryB64, ivRecoveryB64)
  const nuevaClave = await crypto.subtle.importKey('raw', base64ABuffer(nuevaClaveDerivadaRawB64), 'AES-GCM', false, ['encrypt'])
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: base64ABuffer(nuevoIvB64) }, nuevaClave, vaultKeyRaw)
  return bufferABase64(cifrado)
}
