// Envío de WhatsApp vía Twilio API. Requiere TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
// y TWILIO_WHATSAPP_FROM (número con "WhatsApp Sender" aprobado por Meta).
// Si no está configurado, no falla: simplemente no envía y lo reporta en el resultado.

export function whatsappConfigurado(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM)
}

// Normaliza un teléfono chileno a formato E.164 (+569XXXXXXXX).
// Acepta variantes: "+56912345678", "56912345678", "912345678", "9 1234 5678", etc.
export function normalizarTelefonoCL(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  const limpio = telefono.replace(/[^\d+]/g, '')
  if (!limpio) return null

  if (limpio.startsWith('+56')) return limpio
  if (limpio.startsWith('56') && limpio.length >= 11) return `+${limpio}`
  if (limpio.startsWith('9') && limpio.length === 9) return `+56${limpio}`
  if (limpio.length === 8) return `+569${limpio}`
  return null
}

export async function enviarWhatsApp(telefono: string, mensaje: string): Promise<boolean> {
  if (!whatsappConfigurado()) return false

  const sid = process.env.TWILIO_ACCOUNT_SID!
  const token = process.env.TWILIO_AUTH_TOKEN!
  const from = process.env.TWILIO_WHATSAPP_FROM!

  try {
    const body = new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${telefono}`,
      Body: mensaje,
    })

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      },
      body,
    })

    return res.ok
  } catch {
    return false
  }
}
