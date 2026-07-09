import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || 'placeholder')
}
const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export async function GET(req: NextRequest) {
  // Vercel cron llama con GET, verificamos el secret
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  return procesarAlertas(null)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const forzar = body.forzar === true
  return procesarAlertas(body.periodo_id || null, forzar)
}

async function procesarAlertas(periodo_id_especifico: string | null, forzar = false) {
  const supabase = createServiceClient()
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Obtener períodos abiertos
  let periodoQuery = supabase
    .from('periodos_facturacion')
    .select('*')
    .eq('estado', 'abierto')
  if (periodo_id_especifico) {
    periodoQuery = periodoQuery.eq('id', periodo_id_especifico)
  }
  const { data: periodos } = await periodoQuery

  if (!periodos || periodos.length === 0) {
    return NextResponse.json({ enviados: 0, mensaje: 'Sin períodos abiertos' })
  }

  // Configuración de alertas por comunidad (macrolote)
  const { data: configs } = await supabase
    .from('config_alertas')
    .select('*')
  type Config = {
    comunidad_id: string; alertas_activas: boolean
    alerta_no_pago?: boolean; alerta_corte?: boolean
    alerta_asamblea?: boolean; alerta_votacion?: boolean
    modo_pruebas?: boolean; email_pruebas?: string
    dias_aviso_vencimiento: number; dias_aviso_corte: number
    frecuencia_reenvio_dias: number; max_por_dia: number
    dia_tope_lectura?: number; avisar_lectura_dias_antes?: number
  }
  const configPorComunidad = new Map<string, Config>(
    ((configs ?? []) as Config[]).map(c => [c.comunidad_id, c])
  )
  const configDefault: Config = {
    comunidad_id: '', alertas_activas: true,
    alerta_no_pago: false, alerta_corte: false, alerta_asamblea: false, alerta_votacion: false,
    modo_pruebas: true, email_pruebas: 'agarridob@gmail.com',
    dias_aviso_vencimiento: 5, dias_aviso_corte: 3,
    frecuencia_reenvio_dias: 0, max_por_dia: 200,
  }

  // Mientras modo_pruebas esté activo, todo correo se redirige a un único destinatario
  // en vez del email real del parcelero, para poder probar sin molestar a los vecinos.
  const destinatario = (config: Config, emailReal: string) =>
    config.modo_pruebas ? (config.email_pruebas || 'agarridob@gmail.com') : emailReal

  let enviados = 0

  for (const periodo of periodos) {
    const config = configPorComunidad.get(periodo.comunidad_id) ?? configDefault
    if (!config.alertas_activas && !forzar) continue

    const fechaVenc = periodo.fecha_vencimiento ? new Date(periodo.fecha_vencimiento + 'T00:00:00') : null

    // Paso automático a mora: cuentas con saldo pendiente de períodos ya vencidos
    if (fechaVenc && fechaVenc < hoy) {
      await supabase
        .from('cuentas_parcela')
        .update({ estado: 'mora' })
        .eq('periodo_id', periodo.id)
        .in('estado', ['pendiente', 'pago_parcial'])
    }
    // ---- Recordatorio de autolectura ----
    // Se avisa a las parcelas que aún no envían su lectura cuando se acerca
    // (o pasó) el día tope del mes del período.
    const diaTope = config.dia_tope_lectura ?? 10
    const fechaTope = new Date(periodo.anio, periodo.mes - 1, diaTope)
    const diasParaTope = Math.ceil((fechaTope.getTime() - hoy.getTime()) / 86400000)
    const debeRecordarLectura = forzar ||
      (diasParaTope <= (config.avisar_lectura_dias_antes ?? 3) && diasParaTope >= -15)

    if (debeRecordarLectura) {
      const [{ data: parcelasActivas }, { data: lecturasPeriodo }, { data: alertasLectura }] = await Promise.all([
        supabase.from('parcelas').select('id, numero, nombre_dueno, email').eq('activa', true).eq('tiene_empalme', true).not('email', 'is', null),
        supabase.from('lecturas').select('parcela_id, estado_validacion').eq('periodo_id', periodo.id),
        supabase.from('alertas_enviadas').select('parcela_id, ultima_vez').eq('periodo_id', periodo.id).eq('tipo', 'lectura'),
      ])

      const conLectura = new Set(
        (lecturasPeriodo ?? [])
          .filter((l: { estado_validacion: string }) => l.estado_validacion !== 'rechazada')
          .map((l: { parcela_id: string }) => l.parcela_id)
      )
      const msReenvioLect = (config.frecuencia_reenvio_dias ?? 0) > 0
        ? config.frecuencia_reenvio_dias * 86400000
        : Infinity
      const yaAvisadas = new Set(
        (alertasLectura ?? [])
          .filter((a: { ultima_vez: string | null }) =>
            !a.ultima_vez || Date.now() - new Date(a.ultima_vez).getTime() < msReenvioLect
          )
          .map((a: { parcela_id: string }) => a.parcela_id)
      )

      for (const p of (parcelasActivas ?? []) as { id: string; numero: number; nombre_dueno: string; email: string }[]) {
        if (enviados >= config.max_por_dia && !forzar) break
        if (conLectura.has(p.id)) continue
        if (!forzar && yaAvisadas.has(p.id)) continue

        await getResend().emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Comité <noreply@resend.dev>',
          to: destinatario(config, p.email),
          subject: diasParaTope >= 0
            ? `📸 Recuerda subir la lectura de tu medidor (plazo: ${fechaTope.toLocaleDateString('es-CL')})`
            : `⚠️ Aún no envías la lectura de tu medidor - ${meses[periodo.mes - 1]} ${periodo.anio}`,
          html: emailLectura({
            nombre: p.nombre_dueno,
            numeroParcela: p.numero,
            periodo: `${meses[periodo.mes - 1]} ${periodo.anio}`,
            fechaTope: fechaTope.toLocaleDateString('es-CL'),
            vencido: diasParaTope < 0,
            appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
          }),
        })
        if (!forzar) {
          await supabase.from('alertas_enviadas').upsert({
            tipo: 'lectura',
            periodo_id: periodo.id,
            parcela_id: p.id,
            ultima_vez: new Date().toISOString(),
          }, { onConflict: 'tipo,periodo_id,parcela_id' })
        }
        enviados++
      }
    }

    const fechaCorte = periodo.fecha_corte ? new Date(periodo.fecha_corte + 'T00:00:00') : null

    const diasVenc = fechaVenc ? Math.ceil((fechaVenc.getTime() - hoy.getTime()) / 86400000) : null
    const diasCorte = fechaCorte ? Math.ceil((fechaCorte.getTime() - hoy.getTime()) / 86400000) : null

    // Enviar alerta de vencimiento (no pago) si faltan ≤ N días (configurable) o ya venció
    const debeAlertarVenc = (config.alerta_no_pago || forzar) && (forzar || (diasVenc !== null && diasVenc <= config.dias_aviso_vencimiento))
    // Enviar alerta de corte si faltan ≤ N días (configurable)
    const debeAlertarCorte = (config.alerta_corte || forzar) && (forzar || (diasCorte !== null && diasCorte <= config.dias_aviso_corte && diasCorte >= 0))

    if (!debeAlertarVenc && !debeAlertarCorte) continue

    // Obtener cuentas pendientes/mora con email del parcelero
    const { data: cuentas } = await supabase
      .from('cuentas_parcela')
      .select('id, parcela_id, monto_prorrateado, monto_pagado, estado, parcela:parcelas(nombre_dueno, email, numero)')
      .eq('periodo_id', periodo.id)
      .in('estado', ['pendiente', 'pago_parcial', 'mora'])

    if (!cuentas || cuentas.length === 0) continue

    // Verificar cuáles ya recibieron alerta (para no duplicar), excepto si se fuerza.
    // Si hay frecuencia de reenvío configurada, una alerta "expira" pasados N días
    // y se vuelve a enviar.
    const { data: alertasYaEnviadas } = await supabase
      .from('alertas_enviadas')
      .select('tipo, parcela_id, ultima_vez')
      .eq('periodo_id', periodo.id)

    const msReenvio = config.frecuencia_reenvio_dias > 0
      ? config.frecuencia_reenvio_dias * 86400000
      : Infinity
    const alertasSet = new Set(
      (alertasYaEnviadas ?? [])
        .filter((a: { ultima_vez: string | null }) =>
          !a.ultima_vez || Date.now() - new Date(a.ultima_vez).getTime() < msReenvio
        )
        .map((a: { tipo: string; parcela_id: string }) => `${a.tipo}:${a.parcela_id}`)
    )

    for (const cuenta of cuentas) {
      if (enviados >= config.max_por_dia && !forzar) break
      const parcela = cuenta.parcela as { nombre_dueno: string; email: string; numero: number }
      const saldo = cuenta.monto_prorrateado - cuenta.monto_pagado
      const nombrePeriodo = `${meses[periodo.mes - 1]} ${periodo.anio}`

      if (debeAlertarVenc && (forzar || !alertasSet.has(`vencimiento:${cuenta.parcela_id}`))) {
        const subject = diasVenc !== null && diasVenc < 0
          ? `⚠️ Cuenta vencida - ${nombrePeriodo}`
          : `⏰ Vencimiento próximo - ${nombrePeriodo}`

        await getResend().emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Comité <noreply@resend.dev>',
          to: destinatario(config, parcela.email),
          subject,
          html: emailVencimiento({
            nombre: parcela.nombre_dueno,
            numeroParcela: parcela.numero,
            periodo: nombrePeriodo,
            monto: cuenta.monto_prorrateado,
            saldo,
            fechaVencimiento: fechaVenc?.toLocaleDateString('es-CL') || '',
            diasRestantes: diasVenc,
            appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
          }),
        })

        if (!forzar) {
          await supabase.from('alertas_enviadas').upsert({
            tipo: 'vencimiento',
            periodo_id: periodo.id,
            parcela_id: cuenta.parcela_id,
            ultima_vez: new Date().toISOString(),
          }, { onConflict: 'tipo,periodo_id,parcela_id' })
        }
        enviados++
      }

      if (debeAlertarCorte && (forzar || !alertasSet.has(`corte:${cuenta.parcela_id}`))) {
        await getResend().emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Comité <noreply@resend.dev>',
          to: destinatario(config, parcela.email),
          subject: `🚨 Aviso de corte de suministro - ${nombrePeriodo}`,
          html: emailCorte({
            nombre: parcela.nombre_dueno,
            numeroParcela: parcela.numero,
            periodo: nombrePeriodo,
            saldo,
            fechaCorte: fechaCorte?.toLocaleDateString('es-CL') || '',
            appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
          }),
        })

        if (!forzar) {
          await supabase.from('alertas_enviadas').upsert({
            tipo: 'corte',
            periodo_id: periodo.id,
            parcela_id: cuenta.parcela_id,
            ultima_vez: new Date().toISOString(),
          }, { onConflict: 'tipo,periodo_id,parcela_id' })
        }
        enviados++
      }
    }
  }

  return NextResponse.json({ enviados })
}

function emailLectura(d: {
  nombre: string; numeroParcela: number; periodo: string;
  fechaTope: string; vencido: boolean; appUrl: string
}) {
  return `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="color:${d.vencido ? '#dc2626' : '#1d4ed8'};">📸 ${d.vencido ? 'Lectura de medidor atrasada' : 'Recuerda subir tu lectura de medidor'}</h2>
  <p>Hola <strong>${d.nombre}</strong> (Parcela #${d.numeroParcela}),</p>
  <p>${d.vencido
    ? `El plazo para enviar la lectura de tu medidor del período <strong>${d.periodo}</strong> venció el <strong>${d.fechaTope}</strong>. Por favor súbela lo antes posible para que tu consumo quede bien calculado.`
    : `Falta poco para el cierre de lecturas del período <strong>${d.periodo}</strong>. Tienes plazo hasta el <strong>${d.fechaTope}</strong>.`}</p>
  <p>Es muy simple: entra al sistema, anota el número de tu medidor y sube una foto donde se vea claro.</p>
  <a href="${d.appUrl}/parcelero" style="display:inline-block;background:#1d4ed8;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px;">Subir mi lectura</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Comité COPOSA — Recordatorio automático</p>
</div>`
}

function emailVencimiento(d: {
  nombre: string; numeroParcela: number; periodo: string;
  monto: number; saldo: number; fechaVencimiento: string;
  diasRestantes: number | null; appUrl: string
}) {
  const alerta = d.diasRestantes !== null && d.diasRestantes < 0
    ? `<p style="color:#dc2626;font-weight:bold;">Tu cuenta está VENCIDA desde el ${d.fechaVencimiento}.</p>`
    : `<p>Tu cuenta vence el <strong>${d.fechaVencimiento}</strong>${d.diasRestantes !== null ? ` (en ${d.diasRestantes} día${d.diasRestantes !== 1 ? 's' : ''})` : ''}.</p>`

  return `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="color:#1d4ed8;">⚡ Macrolote COPOSA — Aviso de vencimiento</h2>
  <p>Hola <strong>${d.nombre}</strong> (Parcela #${d.numeroParcela}),</p>
  <p>Tienes una cuenta pendiente del período <strong>${d.periodo}</strong>:</p>
  <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="margin:4px 0;">Monto total: <strong>$${d.monto.toLocaleString('es-CL')}</strong></p>
    <p style="margin:4px 0;">Saldo pendiente: <strong style="color:#dc2626;">$${d.saldo.toLocaleString('es-CL')}</strong></p>
  </div>
  ${alerta}
  <a href="${d.appUrl}/parcelero" style="display:inline-block;background:#1d4ed8;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px;">Ver mi cuenta</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Comité de Parcelas — Sistema automático de notificaciones</p>
</div>`
}

function emailCorte(d: {
  nombre: string; numeroParcela: number; periodo: string;
  saldo: number; fechaCorte: string; appUrl: string
}) {
  return `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="color:#dc2626;">🚨 Aviso de corte de suministro eléctrico</h2>
  <p>Hola <strong>${d.nombre}</strong> (Parcela #${d.numeroParcela}),</p>
  <p>Te informamos que existe un saldo pendiente del período <strong>${d.periodo}</strong> por <strong>$${d.saldo.toLocaleString('es-CL')}</strong>.</p>
  <p style="color:#dc2626;font-weight:bold;">El suministro eléctrico podría ser cortado el <strong>${d.fechaCorte}</strong> si no se regulariza el pago antes de esa fecha.</p>
  <p>Por favor contacta al comité para coordinar el pago a la brevedad.</p>
  <a href="${d.appUrl}/parcelero" style="display:inline-block;background:#dc2626;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px;">Ver mi cuenta</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Comité de Parcelas — Sistema automático de notificaciones</p>
</div>`
}
