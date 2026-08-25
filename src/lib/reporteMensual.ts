import PDFDocument from 'pdfkit'
import { createServiceClient } from '@/lib/supabase/server'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const AZUL = '#1d4ea8'
const VERDE = '#15803d'
const ROJO = '#b91c1c'
const GRIS = '#6b7280'
const GRIS_CLARO = '#f1f5f9'
const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

export function nombreMesAnio(mes: number, anio: number) {
  return `${MESES[mes - 1]} ${anio}`
}

// pdfkit con las fuentes base (Helvetica) no tiene glifos de emoji — solo
// WinAnsi/Latin-1 — así que hay que sacarlos del texto o salen como basura.
function sinEmoji(texto: string) {
  return texto.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}️]/gu, '').trim()
}

function encabezado(doc: PDFKit.PDFDocument, nombrePeriodo: string) {
  const ancho = doc.page.width
  doc.rect(0, 0, ancho, 90).fill(AZUL)
  doc.fillColor('#ffffff').fontSize(19).font('Helvetica-Bold')
    .text('Macrolote COPOSA', 40, 26)
  doc.fontSize(11).font('Helvetica').fillColor('#dbeafe')
    .text('Reporte mensual de transparencia', 40, 52)
  doc.fontSize(10).fillColor('#bfdbfe')
    .text(nombrePeriodo, 40, 68)
  doc.fontSize(8).fillColor('#bfdbfe')
    .text(`Generado ${new Date().toLocaleDateString('es-CL')}`, ancho - 160, 68, { width: 120, align: 'right' })
  doc.y = 112
  doc.fillColor('#000')
}

function tarjeta(doc: PDFKit.PDFDocument, x: number, y: number, w: number, titulo: string, filas: [string, string, string?][]) {
  const alto = 26 + filas.length * 18
  doc.roundedRect(x, y, w, alto, 6).fillAndStroke(GRIS_CLARO, '#e2e8f0')
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(sinEmoji(titulo), x + 14, y + 10)
  let fy = y + 30
  for (const [label, valor, color] of filas) {
    doc.font('Helvetica').fontSize(9.5).fillColor(GRIS).text(label, x + 14, fy, { width: w - 28 })
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(color ?? '#0f172a').text(valor, x + 14, fy, { width: w - 28, align: 'right' })
    fy += 18
  }
  return alto
}

type Movimiento = { monto: number; concepto: string; fecha: string }

function listaMovimientos(doc: PDFKit.PDFDocument, x: number, y: number, w: number, titulo: string, items: Movimiento[], total: number, color: string) {
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(titulo, x, y, { width: w - 90 })
  doc.font('Helvetica-Bold').fontSize(11).fillColor(color).text($(total), x, y, { width: w, align: 'right' })
  let fy = y + 20
  if (items.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(GRIS).text('Sin movimientos este mes', x, fy, { width: w })
    return fy + 16 - y
  }
  for (const m of items) {
    if (fy > doc.page.height - 100) break
    doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text(new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-CL'), x, fy, { width: w })
    fy += 11
    doc.font('Helvetica').fontSize(9).fillColor('#1f2937').text(m.concepto, x, fy, { width: w - 70 })
    doc.font('Helvetica-Bold').fontSize(9).fillColor(color).text($(Number(m.monto)), x, fy, { width: w, align: 'right' })
    fy += 16
  }
  return fy - y
}

// Arma el reporte de transparencia de un mes calendario puntual: ingresos y
// egresos de caja de ese mes, saldo de caja acumulado a la fecha, y el avance
// del período de luz/GC de ese mes si existe.
export async function generarReporteMensualPDF(mes: number, anio: number): Promise<Buffer> {
  const supabase = createServiceClient()
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`

  const [
    { data: periodoLuz },
    { data: periodoGC },
    { data: saldoInicialRow },
    { data: todosMovimientos },
    { data: ingresosMes },
    { data: egresosMes },
  ] = await Promise.all([
    supabase.from('periodos_facturacion').select('*').eq('mes', mes).eq('anio', anio).maybeSingle(),
    supabase.from('periodos_gc').select('*').eq('mes', mes).eq('anio', anio).maybeSingle(),
    supabase.from('caja_saldos').select('saldo_final').order('fecha', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('caja_movimientos').select('tipo, monto'),
    supabase.from('caja_movimientos').select('tipo, monto, concepto, fecha').eq('tipo', 'ingreso').gte('fecha', desde).lt('fecha', hasta).order('fecha', { ascending: false }),
    supabase.from('caja_movimientos').select('tipo, monto, concepto, fecha').eq('tipo', 'egreso').gte('fecha', desde).lt('fecha', hasta).order('fecha', { ascending: false }),
  ])

  let luz: { monto_prorrateado: number; monto_pagado: number; estado: string }[] = []
  if (periodoLuz) {
    const { data } = await supabase.from('cuentas_parcela').select('monto_prorrateado, monto_pagado, estado').eq('periodo_id', periodoLuz.id)
    luz = data ?? []
  }
  const facturadoLuz = luz.reduce((s, c) => s + Number(c.monto_prorrateado), 0)
  const recaudadoLuz = luz.reduce((s, c) => s + Number(c.monto_pagado), 0)
  const pagadasLuz = luz.filter(c => c.estado === 'pagado').length
  const enMoraLuz = luz.filter(c => c.estado === 'mora').length

  let gcRows: { monto: number; monto_pagado: number; estado: string }[] = []
  if (periodoGC) {
    const { data } = await supabase.from('cuentas_gc').select('monto, monto_pagado, estado').eq('periodo_id', periodoGC.id)
    gcRows = data ?? []
  }
  const facturadoGC = gcRows.reduce((s, c) => s + Number(c.monto), 0)
  const recaudadoGC = gcRows.reduce((s, c) => s + Number(c.monto_pagado), 0)
  const pagadasGC = gcRows.filter(c => c.estado === 'pagado').length

  const SALDO_INICIAL = saldoInicialRow?.saldo_final ?? 0
  const todos = (todosMovimientos ?? []) as { tipo: string; monto: number }[]
  const saldoCajaActual = SALDO_INICIAL
    + todos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
    - todos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)

  const ingresos = (ingresosMes ?? []) as Movimiento[]
  const egresos = (egresosMes ?? []) as Movimiento[]
  const totalIngresosMes = ingresos.reduce((s, m) => s + Number(m.monto), 0)
  const totalEgresosMes = egresos.reduce((s, m) => s + Number(m.monto), 0)

  const nombrePeriodo = nombreMesAnio(mes, anio)

  const doc = new PDFDocument({ margin: 0, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const pdfPromise = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  encabezado(doc, nombrePeriodo)

  const margin = 40
  const colW = (doc.page.width - margin * 2 - 16) / 2

  const altoLuz = tarjeta(doc, margin, doc.y, colW, 'Cuenta de Luz', periodoLuz ? [
    ['Facturado', $(facturadoLuz)],
    ['Recaudado', $(recaudadoLuz), VERDE],
    ['Cuentas al día', `${pagadasLuz} / ${luz.length}`],
    ...(enMoraLuz > 0 ? [['En mora', String(enMoraLuz), ROJO] as [string, string, string]] : []),
  ] : [['Estado', 'Sin período este mes', GRIS]])
  const altoGC = tarjeta(doc, margin + colW + 16, doc.y, colW, 'Gastos Comunes', periodoGC ? [
    ['Facturado', $(facturadoGC)],
    ['Recaudado', $(recaudadoGC), VERDE],
    ['Cuentas al día', `${pagadasGC} / ${gcRows.length}`],
  ] : [['Estado', 'Sin período este mes', GRIS]])

  doc.y = doc.y + Math.max(altoLuz, altoGC) + 24

  doc.roundedRect(margin, doc.y, doc.page.width - margin * 2, 44, 6).fill('#eff6ff')
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(11).text('Saldo de caja actual', margin + 14, doc.y + 14)
  doc.fontSize(14).text($(saldoCajaActual), margin, doc.y + 12, { width: doc.page.width - margin * 2 - 14, align: 'right' })
  doc.y += 44 + 22
  doc.fillColor('#000').font('Helvetica')

  const yListas = doc.y
  const altoIngresos = listaMovimientos(doc, margin, yListas, colW, 'Ingresos del mes', ingresos, totalIngresosMes, VERDE)
  const altoEgresos = listaMovimientos(doc, margin + colW + 16, yListas, colW, 'Egresos del mes', egresos, totalEgresosMes, ROJO)
  doc.y = yListas + Math.max(altoIngresos, altoEgresos) + 20

  doc.fontSize(8).fillColor(GRIS)
    .text('Comité Macrolote COPOSA - Reporte generado automáticamente por el sistema', margin, doc.page.height - 40, { align: 'center', width: doc.page.width - margin * 2 })

  doc.end()
  return pdfPromise
}
