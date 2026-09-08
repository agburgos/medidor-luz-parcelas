import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import PDFDocument from 'pdfkit'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// PDF: parcelas que no pagaron el último período facturado, con su deuda
// acumulada total (ese período + otros períodos pendientes + moras anteriores).
export async function GET() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()

  const { data: ultimoPeriodo } = await supabase
    .from('periodos_facturacion')
    .select('id, mes, anio')
    .gt('monto_total_factura', 0)
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!ultimoPeriodo) {
    return NextResponse.json({ error: 'No hay ningún período facturado aún' }, { status: 400 })
  }

  const [{ data: cuentas }, { data: moras }] = await Promise.all([
    supabase
      .from('cuentas_parcela')
      .select('periodo_id, parcela_id, monto_prorrateado, monto_pagado, estado, parcela:parcelas(numero, nombre_dueno, telefono)'),
    supabase
      .from('moras_anteriores')
      .select('parcela_id, monto, monto_pagado, parcela:parcelas(numero, nombre_dueno, telefono)')
      .not('estado', 'in', '(pagado,en_revision)'),
  ])

  type Cuenta = {
    periodo_id: string; parcela_id: string; monto_prorrateado: number; monto_pagado: number; estado: string
    parcela: { numero: number; nombre_dueno: string; telefono: string | null }
  }
  const todas = (cuentas ?? []) as unknown as Cuenta[]
  type MoraConParcela = { parcela_id: string; monto: number; monto_pagado: number; parcela: { numero: number; nombre_dueno: string; telefono: string | null } }
  const morasConParcela = (moras ?? []) as unknown as MoraConParcela[]

  const deudaMoraPorParcela = new Map<string, number>()
  for (const m of morasConParcela) {
    const saldo = Math.max(Number(m.monto) - Number(m.monto_pagado), 0)
    deudaMoraPorParcela.set(m.parcela_id, (deudaMoraPorParcela.get(m.parcela_id) ?? 0) + saldo)
  }

  const deudaTotalPorParcela = new Map<string, number>()
  for (const c of todas) {
    const saldo = Math.max(Number(c.monto_prorrateado) - Number(c.monto_pagado), 0)
    if (saldo <= 0) continue
    deudaTotalPorParcela.set(c.parcela_id, (deudaTotalPorParcela.get(c.parcela_id) ?? 0) + saldo)
  }

  // TODOS los que tienen algún saldo pendiente (en el último período o en
  // cualquier período anterior, o solo en moras) — no solo quienes deben
  // específicamente en el último período facturado. Así el total de este PDF
  // siempre cuadra contra el total del reporte web de cobranza.
  const parcelaInfoPorId = new Map<string, { numero: number; nombre: string; telefono: string }>()
  for (const c of todas) {
    if (!parcelaInfoPorId.has(c.parcela_id)) {
      parcelaInfoPorId.set(c.parcela_id, { numero: c.parcela.numero, nombre: c.parcela.nombre_dueno, telefono: c.parcela.telefono || '—' })
    }
  }
  for (const m of morasConParcela) {
    if (!parcelaInfoPorId.has(m.parcela_id) && m.parcela) {
      parcelaInfoPorId.set(m.parcela_id, { numero: m.parcela.numero, nombre: m.parcela.nombre_dueno, telefono: m.parcela.telefono || '—' })
    }
  }
  const deudaUltimoPorParcela = new Map<string, number>()
  for (const c of todas) {
    if (c.periodo_id === ultimoPeriodo.id) {
      const saldo = Math.max(c.monto_prorrateado - c.monto_pagado, 0)
      deudaUltimoPorParcela.set(c.parcela_id, (deudaUltimoPorParcela.get(c.parcela_id) ?? 0) + saldo)
    }
  }

  const idsConDeuda = new Set<string>([...deudaTotalPorParcela.keys(), ...deudaMoraPorParcela.keys()])
  const filas = [...idsConDeuda]
    .map(parcelaId => {
      const info = parcelaInfoPorId.get(parcelaId)
      const deudaUltimoPeriodo = deudaUltimoPorParcela.get(parcelaId) ?? 0
      const mora = deudaMoraPorParcela.get(parcelaId) ?? 0
      const otrosPendientes = deudaTotalPorParcela.get(parcelaId) ?? 0
      const acumulado = otrosPendientes + mora
      if (acumulado <= 0 || !info) return null
      return {
        numero: info.numero,
        nombre: info.nombre,
        telefono: info.telefono,
        deudaUltimoPeriodo,
        acumulado,
      }
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .sort((a, b) => b.acumulado - a.acumulado)

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const nombrePeriodo = `${meses[ultimoPeriodo.mes - 1]} ${ultimoPeriodo.anio}`

  // Generar PDF con pdfkit
  const doc = new PDFDocument({ margin: 40, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  const pdfPromise = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  doc.fontSize(16).text('COPOSA — Deudores (todos los saldos pendientes)', { align: 'left' })
  doc.fontSize(10).fillColor('#666').text(`Último período facturado: ${nombrePeriodo}  ·  Generado: ${new Date().toLocaleDateString('es-CL')}`)
  doc.fontSize(9).fillColor('#888').text('Incluye deuda de cualquier período pendiente y moras anteriores, no solo el último período. El total de este reporte cuadra contra "Deuda total por cobrar" de Reportes de cobranza.')
  doc.moveDown(1)

  const colX = [40, 90, 260, 340, 440]
  const colW = [50, 170, 80, 100, 110]
  const headerY = doc.y
  doc.fontSize(9).fillColor('#000')
  const headers = ['Parcela', 'Propietario', 'Teléfono', `Deuda ${nombrePeriodo}`, 'Acumulado']
  headers.forEach((h, i) => doc.text(h, colX[i], headerY, { width: colW[i], continued: false }))
  doc.moveDown(0.5)
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke()
  doc.moveDown(0.3)

  let deudaUltimoTotal = 0
  let acumuladoTotal = 0

  for (const f of filas) {
    if (doc.y > 760) {
      doc.addPage()
      doc.y = 40
    }
    const y = doc.y
    doc.fontSize(9).fillColor('#000')
    doc.text(`#${f.numero}`, colX[0], y, { width: colW[0] })
    doc.text(f.nombre, colX[1], y, { width: colW[1] })
    doc.text(f.telefono, colX[2], y, { width: colW[2] })
    doc.text($(f.deudaUltimoPeriodo), colX[3], y, { width: colW[3] })
    doc.fillColor('#b91c1c').text($(f.acumulado), colX[4], y, { width: colW[4] })
    doc.moveDown(0.6)
    deudaUltimoTotal += f.deudaUltimoPeriodo
    acumuladoTotal += f.acumulado
  }

  if (filas.length === 0) {
    doc.fontSize(10).fillColor('#666').text('Sin deudores en este período. 🎉')
  } else {
    doc.moveDown(0.3)
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke()
    doc.moveDown(0.3)
    const yT = doc.y
    doc.fontSize(9).fillColor('#000').text('TOTAL', colX[1], yT, { width: colW[1] })
    doc.text($(deudaUltimoTotal), colX[3], yT, { width: colW[3] })
    doc.fillColor('#b91c1c').text($(acumuladoTotal), colX[4], yT, { width: colW[4] })
  }

  doc.end()
  const pdfBuffer = await pdfPromise

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="deudores-${nombrePeriodo.replace(' ', '-')}.pdf"`,
    },
  })
}
