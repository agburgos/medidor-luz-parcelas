import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { enviarWhatsApp, normalizarTelefonoCL, whatsappConfigurado } from '@/lib/whatsapp'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || 'placeholder')
}

export const CATEGORIAS_INCIDENCIA: Record<string, string> = {
  intruso: '🔴 Intruso / Robo',
  emergencia_medica: '🏥 Emergencia médica',
  incendio: '🔥 Incendio / Gas',
  otro: '⚠️ Otro',
  falsa_alarma: 'Falsa alarma',
}

interface DatosIncidencia {
  id: string
  categoria: string
  descripcion: string | null
  latitud: number | null
  longitud: number | null
  fecha_activacion: string
  parcela: { numero: number; nombre_dueno: string; telefono: string | null }
}

export interface ResultadoNotificacion {
  modo_pruebas: boolean
  email_parceleros: number
  whatsapp_parceleros: number
  email_porteria: boolean
  whatsapp_porteria: boolean
  whatsapp_disponible: boolean
}

function linkMapa(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null
  return `https://www.google.com/maps?q=${lat},${lng}`
}

function textoMensaje(inc: DatosIncidencia, tipo: 'activacion' | 'retraccion'): { asunto: string; textoPlano: string; html: string } {
  const categoriaTxt = CATEGORIAS_INCIDENCIA[inc.categoria] ?? inc.categoria
  const fecha = new Date(inc.fecha_activacion).toLocaleString('es-CL')
  const mapa = linkMapa(inc.latitud, inc.longitud)

  if (tipo === 'retraccion') {
    const asunto = `✅ Falsa alarma — Parcela #${inc.parcela.numero}`
    const textoPlano = `AVISO: La alerta de pánico de la Parcela #${inc.parcela.numero} (${inc.parcela.nombre_dueno}) activada el ${fecha} fue una FALSA ALARMA. Todo está en orden, no se requiere acción.`
    const html = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="color:#059669;">✅ Falsa alarma — todo en orden</h2>
  <p>La alerta de pánico de la <strong>Parcela #${inc.parcela.numero}</strong> (${inc.parcela.nombre_dueno}), activada el ${fecha}, fue reportada como <strong>falsa alarma</strong>.</p>
  <p style="color:#6b7280;">No se requiere ninguna acción.</p>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Sistema de Emergencias COPOSA</p>
</div>`
    return { asunto, textoPlano, html }
  }

  const asunto = `🚨 ALERTA DE PÁNICO — Parcela #${inc.parcela.numero} (${categoriaTxt})`
  const textoPlano = [
    `🚨 ALERTA DE PÁNICO 🚨`,
    `Parcela: #${inc.parcela.numero} — ${inc.parcela.nombre_dueno}`,
    `Tipo: ${categoriaTxt}`,
    inc.descripcion ? `Detalle: ${inc.descripcion}` : null,
    `Hora: ${fecha}`,
    mapa ? `Ubicación: ${mapa}` : 'Ubicación: no disponible',
    `Teléfono contacto: ${inc.parcela.telefono || 'no registrado'}`,
  ].filter(Boolean).join('\n')

  const html = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:3px solid #dc2626;border-radius:12px;">
  <h1 style="color:#dc2626;margin-top:0;">🚨 ALERTA DE PÁNICO</h1>
  <p style="font-size:18px;"><strong>Parcela #${inc.parcela.numero}</strong> — ${inc.parcela.nombre_dueno}</p>
  <p><strong>Tipo:</strong> ${categoriaTxt}</p>
  ${inc.descripcion ? `<p><strong>Detalle:</strong> ${inc.descripcion}</p>` : ''}
  <p><strong>Hora:</strong> ${fecha}</p>
  <p><strong>Teléfono de contacto:</strong> ${inc.parcela.telefono || 'no registrado'}</p>
  ${mapa ? `<p><a href="${mapa}" style="display:inline-block;background:#dc2626;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px;">📍 Ver ubicación en el mapa</a></p>` : '<p style="color:#9ca3af;">Ubicación no disponible</p>'}
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Sistema de Emergencias COPOSA — si es una emergencia real, llama también a Carabineros (133) o Ambulancia (131)</p>
</div>`
  return { asunto, textoPlano, html }
}

// Envía notificaciones de una incidencia (activación o retracción de falsa alarma)
// a todos los parceleros por email + WhatsApp (si está configurado), y a portería.
// Respeta el modo de pruebas de config_alertas: si está activo, todo va solo al
// correo de pruebas y NO se dispara ningún WhatsApp real.
export async function notificarIncidencia(
  incidenciaId: string,
  tipo: 'activacion' | 'retraccion'
): Promise<ResultadoNotificacion> {
  const supabase = createServiceClient()

  const { data: incidenciaRaw } = await supabase
    .from('incidencias')
    .select('id, categoria, descripcion, latitud, longitud, fecha_activacion, parcela:parcelas(numero, nombre_dueno, telefono)')
    .eq('id', incidenciaId)
    .single()

  const resultado: ResultadoNotificacion = {
    modo_pruebas: false,
    email_parceleros: 0,
    whatsapp_parceleros: 0,
    email_porteria: false,
    whatsapp_porteria: false,
    whatsapp_disponible: whatsappConfigurado(),
  }

  if (!incidenciaRaw) return resultado

  const inc = incidenciaRaw as unknown as DatosIncidencia
  const { asunto, textoPlano, html } = textoMensaje(inc, tipo)

  const { data: config } = await supabase
    .from('config_alertas')
    .select('modo_pruebas, email_pruebas, whatsapp_pruebas, porteria_email, porteria_whatsapp')
    .limit(1)
    .maybeSingle()

  const modoPruebas = !!config?.modo_pruebas
  resultado.modo_pruebas = modoPruebas

  // --- Email a parceleros ---
  const { data: parcelas } = await supabase
    .from('parcelas')
    .select('email, telefono')
    .eq('activa', true)
    .not('email', 'is', null)

  const destinatariosEmail = modoPruebas
    ? [config?.email_pruebas || 'agarridob@gmail.com']
    : (parcelas ?? []).map((p: { email: string }) => p.email)

  for (const email of destinatariosEmail) {
    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Comité <noreply@resend.dev>',
      to: email,
      subject: asunto,
      html,
    })
    resultado.email_parceleros++
  }

  // --- WhatsApp a parceleros con teléfono registrado ---
  // En modo de pruebas, en vez de saltarse el envío, se manda TODO (el mensaje
  // "a vecinos" y el de "portería") solo al número de whatsapp_pruebas, para
  // poder probar el flujo completo sin avisar a nadie real.
  if (whatsappConfigurado()) {
    const telWhatsappPruebas = modoPruebas ? normalizarTelefonoCL(config?.whatsapp_pruebas) : null

    const telefonos = modoPruebas
      ? (telWhatsappPruebas ? [telWhatsappPruebas] : [])
      : (parcelas ?? [])
          .map((p: { telefono: string | null }) => normalizarTelefonoCL(p.telefono))
          .filter((t: string | null): t is string => !!t)

    for (const tel of telefonos) {
      const ok = await enviarWhatsApp(tel, modoPruebas ? `[PRUEBA — iría a vecinos]\n${textoPlano}` : textoPlano)
      if (ok) resultado.whatsapp_parceleros++
    }
  }

  // --- Portería: email + WhatsApp ---
  const porteriaEmail = modoPruebas ? (config?.email_pruebas || null) : (config?.porteria_email || null)
  if (porteriaEmail) {
    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Comité <noreply@resend.dev>',
      to: porteriaEmail,
      subject: `[PORTERÍA] ${asunto}`,
      html,
    })
    resultado.email_porteria = true
  }

  if (whatsappConfigurado()) {
    const telPorteria = modoPruebas
      ? normalizarTelefonoCL(config?.whatsapp_pruebas)
      : (config?.porteria_whatsapp ? normalizarTelefonoCL(config.porteria_whatsapp) : null)

    if (telPorteria) {
      resultado.whatsapp_porteria = await enviarWhatsApp(telPorteria, modoPruebas ? `[PRUEBA — iría a portería]\n${textoPlano}` : `[PORTERÍA]\n${textoPlano}`)
    }
  }

  return resultado
}
