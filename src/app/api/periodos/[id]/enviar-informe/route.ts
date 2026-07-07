import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Falta configurar RESEND_API_KEY para enviar correos' }, { status: 400 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Reutilizar el cálculo del reporte
  const base = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3002`
  const repRes = await fetch(`${base}/api/periodos/${id}/reporte`, { cache: 'no-store' })
  const reporte = await repRes.json()
  if (!repRes.ok) return NextResponse.json({ error: reporte.error }, { status: 400 })

  const { periodo, filas } = reporte
  const nombrePeriodo = `${meses[periodo.mes - 1]} ${periodo.anio}`
  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  type Fila = typeof filas[number]
  const conEmail = filas.filter((f: Fila) => f.email && f.estado_lectura !== 'DESCONECTADO')

  let enviados = 0
  const errores: string[] = []

  for (const f of conEmail) {
    const html = `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <h2 style="color:#1d4ed8;">⚡ MACROLOTE COPOSA — Informe de consumo eléctrico</h2>
  <p>Hola <strong>${f.nombre}</strong> (Parcela #${f.numero}),</p>
  <p>Este es tu detalle de consumo del período <strong>${nombrePeriodo}</strong>:</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
    <tr><td style="padding:6px;border:1px solid #e5e7eb;">Lectura anterior</td><td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">${f.estado_lectura === 'NUEVO' ? 'NUEVO' : f.lectura_anterior}</td></tr>
    <tr><td style="padding:6px;border:1px solid #e5e7eb;">Lectura actual</td><td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">${f.estado_lectura === 'S/INFO' ? 'S/INFO' : f.lectura_actual}</td></tr>
    <tr><td style="padding:6px;border:1px solid #e5e7eb;">Consumo del mes</td><td style="padding:6px;border:1px solid #e5e7eb;text-align:right;"><strong>${f.consumo_kwh} kWh</strong></td></tr>
    <tr><td style="padding:6px;border:1px solid #e5e7eb;">Consumo acumulado</td><td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">${f.consumo_acumulado} kWh</td></tr>
    <tr><td style="padding:6px;border:1px solid #e5e7eb;">Costo consumo (${$(periodo.costo_unitario_kwh)}/kWh)</td><td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">${$(f.monto_consumo)}</td></tr>
    <tr><td style="padding:6px;border:1px solid #e5e7eb;">Cargo fijo</td><td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">${$(f.monto_cargo_fijo)}</td></tr>
    <tr><td style="padding:6px;border:1px solid #e5e7eb;">Total del mes</td><td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">${$(f.total_pagar)}</td></tr>
    ${f.mora_anterior > 0 ? `<tr><td style="padding:6px;border:1px solid #e5e7eb;color:#dc2626;">Mora anterior pendiente</td><td style="padding:6px;border:1px solid #e5e7eb;text-align:right;color:#dc2626;font-weight:bold;">${$(f.mora_anterior)}</td></tr>` : ''}
    <tr style="background:#eff6ff;"><td style="padding:6px;border:1px solid #e5e7eb;font-weight:bold;">TOTAL A PAGAR</td><td style="padding:6px;border:1px solid #e5e7eb;text-align:right;font-weight:bold;color:#1d4ed8;">${$(f.total_con_mora ?? f.total_pagar)}</td></tr>
  </table>
  ${f.estado_lectura ? `<p style="color:#b45309;background:#fef3c7;padding:8px;border-radius:6px;font-size:13px;">Nota: tu lectura este mes figura como <strong>${f.estado_lectura}</strong>.</p>` : ''}
  <p style="font-weight:bold;">Plazo para pagar: ${periodo.fecha_vencimiento ? new Date(periodo.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL') : '—'}</p>
  ${periodo.fecha_corte ? `<p style="color:#dc2626;font-size:13px;">Fecha de corte por no pago: ${new Date(periodo.fecha_corte + 'T00:00:00').toLocaleDateString('es-CL')}</p>` : ''}
  <a href="${base}/parcelero" style="display:inline-block;background:#1d4ed8;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px;">Ver mi cuenta e histórico</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Comité COPOSA — Informe automático de consumo eléctrico</p>
</div>`

    try {
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Comité COPOSA <noreply@resend.dev>',
        to: f.email,
        subject: `⚡ Informe de consumo ${nombrePeriodo} — Parcela #${f.numero}: ${$(f.total_pagar)}`,
        html,
      })
      if (error) errores.push(`#${f.numero}: ${error.message}`)
      else enviados++
    } catch (e) {
      errores.push(`#${f.numero}: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  return NextResponse.json({
    enviados,
    sin_email: filas.length - conEmail.length,
    errores: errores.length ? errores : undefined,
  })
}
