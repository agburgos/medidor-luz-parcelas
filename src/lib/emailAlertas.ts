import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || 'placeholder')
}

// Envía un correo a todas las parcelas activas con email, respetando el switch
// individual de ese tipo de alerta y el modo de pruebas (todo va a un solo correo
// mientras el software no esté liberado a los vecinos).
export async function enviarCorreoEvento(
  tipoConfig: 'alerta_asamblea' | 'alerta_votacion',
  asunto: string,
  html: string
): Promise<{ enviados: number }> {
  const supabase = createServiceClient()

  const { data: config } = await supabase
    .from('config_alertas')
    .select('modo_pruebas, email_pruebas, alerta_asamblea, alerta_votacion')
    .limit(1)
    .maybeSingle()

  if (!config || !config[tipoConfig]) return { enviados: 0 }

  const { data: parcelas } = await supabase
    .from('parcelas')
    .select('email')
    .eq('activa', true)
    .not('email', 'is', null)

  const destinatarios = config.modo_pruebas
    ? [config.email_pruebas || 'agarridob@gmail.com']
    : (parcelas ?? []).map((p: { email: string }) => p.email)

  let enviados = 0
  for (const email of destinatarios) {
    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Comité <noreply@resend.dev>',
      to: email,
      subject: asunto,
      html,
    })
    enviados++
  }

  return { enviados }
}
