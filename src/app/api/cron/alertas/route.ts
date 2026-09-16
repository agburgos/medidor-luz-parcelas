import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { generarReporteMensualPDF, nombreMesAnio } from '@/lib/reporteMensual'

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
  // Botón manual: si viene "tipo", el envío forzado queda acotado a ESE tipo
  // de alerta únicamente (nunca mezcla vencimiento con corte, ni dispara el
  // recordatorio de lectura de paso).
  const tipoForzado = body.tipo === 'corte' || body.tipo === 'vencimiento' ? body.tipo : null
  return procesarAlertas(body.periodo_id || null, forzar, tipoForzado)
}

async function procesarAlertas(periodo_id_especifico: string | null, forzar = false, tipoForzado: 'corte' | 'vencimiento' | null = null) {
  const supabase = createServiceClient()
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Períodos "abierto" (para el recordatorio de lectura) Y "cerrado" con
  // factura ya calculada (para vencimiento/corte/mora) — un período cerrado
  // sigue teniendo cuentas pendientes que cobrar, así que igual debe alertar.
  let periodoQuery = supabase
    .from('periodos_facturacion')
    .select('*')
    .or('estado.eq.abierto,and(estado.eq.cerrado,prorrateo_calculado.eq.true)')
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
    reporte_mensual_activo?: boolean; reporte_mensual_ultimo_enviado?: string | null
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

  // ---- Reporte mensual de transparencia (día 1 de cada mes) ----
  const esDiaUno = hoy.getDate() === 1
  for (const config of (configs ?? []) as Config[]) {
    if (!config.reporte_mensual_activo || !config.alertas_activas) continue
    if (!forzar && !esDiaUno) continue
    const yaEnviadoEsteMes = config.reporte_mensual_ultimo_enviado?.slice(0, 7) === hoy.toISOString().slice(0, 7)
    if (!forzar && yaEnviadoEsteMes) continue

    const { data: parcelasActivas } = await supabase
      .from('parcelas').select('email').eq('activa', true).not('email', 'is', null)

    const destinatarios: string[] = config.modo_pruebas
      ? [config.email_pruebas || 'agarridob@gmail.com']
      : [...new Set(((parcelasActivas ?? []) as { email: string }[]).map(p => p.email))]

    try {
      const mesReporte = hoy.getMonth() === 0 ? 12 : hoy.getMonth()
      const anioReporte = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear()
      const pdfBuffer = await generarReporteMensualPDF(mesReporte, anioReporte)
      const nombrePeriodo = nombreMesAnio(mesReporte, anioReporte)
      for (const email of destinatarios) {
        await getResend().emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Comité <noreply@resend.dev>',
          to: email,
          subject: `📄 Reporte mensual de transparencia — ${nombrePeriodo}`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#1d4ed8;">📄 Reporte mensual de transparencia</h2>
            <p>Adjunto encontrarás el reporte de ${nombrePeriodo}: ingresos, gastos y saldo de caja de la comunidad.</p>
            <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Comité COPOSA — Reporte automático mensual</p>
          </div>`,
          attachments: [{ filename: `reporte-transparencia-coposa-${anioReporte}-${String(mesReporte).padStart(2, '0')}.pdf`, content: pdfBuffer }],
        })
        enviados++
      }
      await supabase.from('config_alertas').update({ reporte_mensual_ultimo_enviado: hoy.toISOString().slice(0, 10) }).eq('comunidad_id', config.comunidad_id)
    } catch {
      // si falla, se reintenta en la próxima corrida del cron (no se marca como enviado)
    }
  }

  // Deuda de luz pendiente por parcela, acumulada de TODOS los períodos —
  // se manda un solo correo por parcela con todos sus períodos vencidos,
  // no un correo separado por cada uno.
  type ItemDeuda = { periodoId: string; nombrePeriodo: string; monto: number; saldo: number; tipo: 'vencimiento' | 'corte'; diasVenc: number | null; fecha: string }
  const deudaPorParcela = new Map<string, { nombre: string; email: string; numero: number; items: ItemDeuda[] }>()
  const marcasPendientes: { tipo: string; periodo_id: string; parcela_id: string }[] = []

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
    const debeRecordarLectura = periodo.estado === 'abierto' && (
      (forzar && !tipoForzado) ||
      (diasParaTope <= (config.avisar_lectura_dias_antes ?? 3) && diasParaTope >= -15)
    )

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
    // "forzar" (botón manual del comité) solo salta la ventana de días y el
    // "ya se le mandó antes" — jamás debe saltarse el switch de ese tipo de
    // alerta en Configuración, o un envío manual de vencimiento terminaría
    // mandando también corte aunque esté apagado.
    const debeAlertarVenc = config.alerta_no_pago && (
      (forzar && (!tipoForzado || tipoForzado === 'vencimiento')) ||
      (diasVenc !== null && diasVenc <= config.dias_aviso_vencimiento)
    )
    // Enviar alerta de corte si faltan ≤ N días (configurable)
    const debeAlertarCorte = config.alerta_corte && (
      (forzar && (!tipoForzado || tipoForzado === 'corte')) ||
      (diasCorte !== null && diasCorte <= config.dias_aviso_corte && diasCorte >= 0)
    )

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
      const parcela = cuenta.parcela as { nombre_dueno: string; email: string; numero: number }
      const saldo = cuenta.monto_prorrateado - cuenta.monto_pagado
      const nombrePeriodo = `${meses[periodo.mes - 1]} ${periodo.anio}`
      if (!parcela.email) continue

      const entry = deudaPorParcela.get(cuenta.parcela_id) ?? { nombre: parcela.nombre_dueno, email: destinatario(config, parcela.email), numero: parcela.numero, items: [] }

      if (debeAlertarVenc && (forzar || !alertasSet.has(`vencimiento:${cuenta.parcela_id}`))) {
        entry.items.push({
          periodoId: periodo.id, nombrePeriodo, monto: cuenta.monto_prorrateado, saldo,
          tipo: 'vencimiento', diasVenc, fecha: fechaVenc?.toLocaleDateString('es-CL') || '',
        })
        if (!forzar) marcasPendientes.push({ tipo: 'vencimiento', periodo_id: periodo.id, parcela_id: cuenta.parcela_id })
      }

      if (debeAlertarCorte && (forzar || !alertasSet.has(`corte:${cuenta.parcela_id}`))) {
        entry.items.push({
          periodoId: periodo.id, nombrePeriodo, monto: cuenta.monto_prorrateado, saldo,
          tipo: 'corte', diasVenc: diasCorte, fecha: fechaCorte?.toLocaleDateString('es-CL') || '',
        })
        if (!forzar) marcasPendientes.push({ tipo: 'corte', periodo_id: periodo.id, parcela_id: cuenta.parcela_id })
      }

      if (entry.items.length > 0) deudaPorParcela.set(cuenta.parcela_id, entry)
    }
  }

  // Un solo correo por parcela con TODOS sus períodos pendientes juntos —
  // no un correo separado por cada período vencido.
  const config0 = (configs ?? [])[0] as Config | undefined
  const maxPorDia = config0?.max_por_dia ?? configDefault.max_por_dia
  for (const [, d] of deudaPorParcela) {
    if (enviados >= maxPorDia && !forzar) break

    const hayCorte = d.items.some(i => i.tipo === 'corte')
    const hayVencida = d.items.some(i => i.tipo === 'vencimiento' && i.diasVenc !== null && i.diasVenc < 0)
    const subject = hayCorte
      ? `🚨 Aviso de corte de suministro`
      : hayVencida
        ? `⚠️ Cuenta(s) vencida(s) — ${d.items.length} período${d.items.length !== 1 ? 's' : ''}`
        : `⏰ Vencimiento próximo — ${d.items.length} período${d.items.length !== 1 ? 's' : ''}`

    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Comité <noreply@resend.dev>',
      to: d.email,
      subject,
      html: emailResumenDeuda({
        nombre: d.nombre,
        numeroParcela: d.numero,
        items: d.items,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
      }),
    })
    enviados++
  }

  if (!forzar && marcasPendientes.length > 0) {
    await supabase.from('alertas_enviadas').upsert(
      marcasPendientes.map(m => ({ ...m, ultima_vez: new Date().toISOString() })),
      { onConflict: 'tipo,periodo_id,parcela_id' }
    )
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

// Un solo correo que lista TODOS los períodos pendientes de la parcela junto
// (en vez de un correo separado por cada período vencido) — evita el spam.
function emailResumenDeuda(d: {
  nombre: string; numeroParcela: number
  items: { periodoId: string; nombrePeriodo: string; monto: number; saldo: number; tipo: 'vencimiento' | 'corte'; diasVenc: number | null; fecha: string }[]
  appUrl: string
}) {
  const totalSaldo = d.items.reduce((s, i) => s + i.saldo, 0)
  const hayCorte = d.items.some(i => i.tipo === 'corte')

  const filas = d.items.map(i => {
    const vencida = i.tipo === 'vencimiento' && i.diasVenc !== null && i.diasVenc < 0
    const etiqueta = i.tipo === 'corte'
      ? `<span style="color:#dc2626;font-weight:bold;">Corte el ${i.fecha}</span>`
      : vencida
        ? `<span style="color:#dc2626;font-weight:bold;">Vencida desde el ${i.fecha}</span>`
        : `Vence el ${i.fecha}${i.diasVenc !== null ? ` (${i.diasVenc} día${i.diasVenc !== 1 ? 's' : ''})` : ''}`
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${i.nombrePeriodo}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:#dc2626;font-weight:bold;">$${i.saldo.toLocaleString('es-CL')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:13px;">${etiqueta}</td>
    </tr>`
  }).join('')

  const encabezado = hayCorte
    ? `<h2 style="color:#dc2626;">🚨 Macrolote COPOSA — Aviso de corte de suministro</h2>`
    : `<h2 style="color:#1d4ed8;">⚡ Macrolote COPOSA — Cuentas pendientes</h2>`

  return `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  ${encabezado}
  <p>Hola <strong>${d.nombre}</strong> (Parcela #${d.numeroParcela}),</p>
  <p>Tienes ${d.items.length} período${d.items.length !== 1 ? 's' : ''} de luz pendiente${d.items.length !== 1 ? 's' : ''}:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:6px 8px;text-align:left;font-size:13px;">Período</th>
        <th style="padding:6px 8px;text-align:right;font-size:13px;">Saldo</th>
        <th style="padding:6px 8px;text-align:left;font-size:13px;">Estado</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
  <p style="font-size:16px;">Total pendiente: <strong style="color:#dc2626;">$${totalSaldo.toLocaleString('es-CL')}</strong></p>
  ${hayCorte ? `<p style="color:#dc2626;font-weight:bold;">El suministro eléctrico podría ser cortado si no se regulariza el pago a la brevedad.</p>` : ''}
  <p>Puedes pagar todos tus períodos pendientes de una vez desde la app, marcando la opción "Pagar todo".</p>
  <a href="${d.appUrl}/parcelero/luz" style="display:inline-block;background:#1d4ed8;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px;">Ver e informar mi pago</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Comité COPOSA — Sistema automático de notificaciones</p>
</div>`
}
