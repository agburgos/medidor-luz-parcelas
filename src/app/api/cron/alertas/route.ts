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

  let enviados = 0

  for (const periodo of periodos) {
    const fechaVenc = periodo.fecha_vencimiento ? new Date(periodo.fecha_vencimiento + 'T00:00:00') : null
    const fechaCorte = periodo.fecha_corte ? new Date(periodo.fecha_corte + 'T00:00:00') : null

    const diasVenc = fechaVenc ? Math.ceil((fechaVenc.getTime() - hoy.getTime()) / 86400000) : null
    const diasCorte = fechaCorte ? Math.ceil((fechaCorte.getTime() - hoy.getTime()) / 86400000) : null

    // Enviar alerta de vencimiento si faltan ≤ 5 días o ya venció
    const debeAlertarVenc = forzar || (diasVenc !== null && diasVenc <= 5)
    // Enviar alerta de corte si faltan ≤ 3 días
    const debeAlertarCorte = forzar || (diasCorte !== null && diasCorte <= 3 && diasCorte >= 0)

    if (!debeAlertarVenc && !debeAlertarCorte) continue

    // Obtener cuentas pendientes/mora con email del parcelero
    const { data: cuentas } = await supabase
      .from('cuentas_parcela')
      .select('id, parcela_id, monto_prorrateado, monto_pagado, estado, parcela:parcelas(nombre_dueno, email, numero)')
      .eq('periodo_id', periodo.id)
      .in('estado', ['pendiente', 'pago_parcial', 'mora'])

    if (!cuentas || cuentas.length === 0) continue

    // Verificar cuáles ya recibieron alerta (para no duplicar), excepto si se fuerza
    const { data: alertasYaEnviadas } = await supabase
      .from('alertas_enviadas')
      .select('tipo, parcela_id')
      .eq('periodo_id', periodo.id)

    const alertasSet = new Set(alertasYaEnviadas?.map((a: { tipo: string; parcela_id: string }) => `${a.tipo}:${a.parcela_id}`) || [])

    for (const cuenta of cuentas) {
      const parcela = cuenta.parcela as { nombre_dueno: string; email: string; numero: number }
      const saldo = cuenta.monto_prorrateado - cuenta.monto_pagado
      const nombrePeriodo = `${meses[periodo.mes - 1]} ${periodo.anio}`

      if (debeAlertarVenc && (forzar || !alertasSet.has(`vencimiento:${cuenta.parcela_id}`))) {
        const subject = diasVenc !== null && diasVenc < 0
          ? `⚠️ Cuenta vencida - ${nombrePeriodo}`
          : `⏰ Vencimiento próximo - ${nombrePeriodo}`

        await getResend().emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Comité <noreply@resend.dev>',
          to: parcela.email,
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
          }, { onConflict: 'tipo,periodo_id,parcela_id', ignoreDuplicates: true })
        }
        enviados++
      }

      if (debeAlertarCorte && (forzar || !alertasSet.has(`corte:${cuenta.parcela_id}`))) {
        await getResend().emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Comité <noreply@resend.dev>',
          to: parcela.email,
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
          }, { onConflict: 'tipo,periodo_id,parcela_id', ignoreDuplicates: true })
        }
        enviados++
      }
    }
  }

  return NextResponse.json({ enviados })
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
  <h2 style="color:#1d4ed8;">⚡ Medidor Luz — Aviso de vencimiento</h2>
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
