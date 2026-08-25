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

// Encuentra el período de facturación más relevante para reportar. No usa el
// mes calendario porque los pagos suelen llegar semanas después del período
// que facturan, y puede haber varios períodos "abiertos" a la vez (se crean
// por adelantado antes de tener lecturas). Prioriza el abierto MÁS ANTIGUO
// que ya tenga el prorrateo calculado (el que realmente se está gestionando
// ahora), y si ninguno lo tiene, el abierto más antiguo a secas.
async function periodoARepotar(periodoId?: string) {
  const supabase = createServiceClient()
  if (periodoId) {
    const { data } = await supabase.from('periodos_facturacion').select('*').eq('id', periodoId).single()
    return data
  }
  const { data: abiertos } = await supabase
    .from('periodos_facturacion')
    .select('*')
    .eq('estado', 'abierto')
    .order('anio', { ascending: true })
    .order('mes', { ascending: true })

  const conProrrateo = abiertos?.find((p: { prorrateo_calculado: boolean }) => p.prorrateo_calculado)
  if (conProrrateo) return conProrrateo
  if (abiertos && abiertos.length > 0) return abiertos[0]

  const { data: cerrados } = await supabase
    .from('periodos_facturacion')
    .select('*')
    .eq('estado', 'cerrado')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
    .limit(1)
  return cerrados?.[0] ?? null
}

function encabezado(doc: PDFKit.PDFDocument, nombrePeriodo: string) {
  const ancho = doc.page.width
  doc.rect(0, 0, ancho, 90).fill(AZUL)
  doc.fillColor('#ffffff').fontSize(19).font('Helvetica-Bold')
    .text('⚡ Macrolote COPOSA', 40, 26)
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
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(titulo, x + 14, y + 10)
  let fy = y + 30
  for (const [label, valor, color] of filas) {
    doc.font('Helvetica').fontSize(9.5).fillColor(GRIS).text(label, x + 14, fy, { width: w - 28 })
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(color ?? '#0f172a').text(valor, x + 14, fy, { width: w - 28, align: 'right' })
    fy += 18
  }
  return alto
}

function barra(doc: PDFKit.PDFDocument, x: number, y: number, w: number, pct: number, label: string) {
  const color = pct >= 80 ? VERDE : pct >= 40 ? '#b45309' : ROJO
  doc.font('Helvetica').fontSize(9.5).fillColor('#374151').text(`${label} (${pct}%)`, x, y)
  const barY = y + 14
  doc.roundedRect(x, barY, w, 8, 4).fill('#e5e7eb')
  doc.roundedRect(x, barY, Math.max(w * Math.min(pct, 100) / 100, 8), 8, 4).fill(color)
}

// Arma el reporte mensual de transparencia (recaudación, gastos, saldo de caja
// y estado de las cuentas) en PDF, para descarga manual o envío automático.
// Si no se pasa periodoId, reporta sobre el período de luz más reciente/relevante.
export async function generarReporteMensualPDF(periodoId?: string): Promise<Buffer> {
  const supabase = createServiceClient()
  const periodo = await periodoARepotar(periodoId)
  if (!periodo) throw new Error('No hay períodos de facturación para reportar')

  const [
    { data: periodoGC },
    { data: cuentasLuz },
    { data: lecturas },
    { data: parcelasConEmpalme },
    { data: saldoInicialRow },
    { data: todosMovimientos },
    { data: ultimosEgresos },
  ] = await Promise.all([
    supabase.from('periodos_gc').select('*').eq('mes', periodo.mes).eq('anio', periodo.anio).maybeSingle(),
    supabase.from('cuentas_parcela').select('monto_prorrateado, monto_pagado, estado').eq('periodo_id', periodo.id),
    supabase.from('lecturas').select('*', { count: 'exact', head: true }).eq('periodo_id', periodo.id).neq('estado_validacion', 'rechazada'),
    supabase.from('parcelas').select('*', { count: 'exact', head: true }).eq('activa', true).eq('tiene_empalme', true),
    supabase.from('caja_saldos').select('saldo_final').order('fecha', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('caja_movimientos').select('tipo, monto'),
    supabase.from('caja_movimientos').select('tipo, monto, concepto, fecha').eq('tipo', 'egreso').order('fecha', { ascending: false }).limit(10),
  ])

  type Cuenta = { monto_prorrateado: number; monto_pagado: number; estado: string }
  const luz = (cuentasLuz ?? []) as Cuenta[]
  const facturadoLuz = luz.reduce((s, c) => s + Number(c.monto_prorrateado), 0)
  const recaudadoLuz = luz.reduce((s, c) => s + Number(c.monto_pagado), 0)
  const pagadasLuz = luz.filter(c => c.estado === 'pagado').length
  const enMoraLuz = luz.filter(c => c.estado === 'mora').length

  const gc = periodoGC ? await supabase.from('cuentas_gc').select('monto, monto_pagado, estado').eq('periodo_id', periodoGC.id) : { data: [] }
  type CuentaGC = { monto: number; monto_pagado: number; estado: string }
  const gcRows = (gc.data ?? []) as CuentaGC[]
  const facturadoGC = gcRows.reduce((s, c) => s + Number(c.monto), 0)
  const recaudadoGC = gcRows.reduce((s, c) => s + Number(c.monto_pagado), 0)
  const pagadasGC = gcRows.filter(c => c.estado === 'pagado').length

  const SALDO_INICIAL = saldoInicialRow?.saldo_final ?? 0
  const todos = (todosMovimientos ?? []) as { tipo: string; monto: number }[]
  const saldoCajaActual = SALDO_INICIAL
    + todos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
    - todos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)

  const totalLecturas = (lecturas as unknown as { count: number })?.count ?? 0
  const pctLecturas = parcelasConEmpalme ? Math.round((totalLecturas / (parcelasConEmpalme as unknown as { count: number }).count) * 100) : 0
  const pctPagadasLuz = luz.length ? Math.round((pagadasLuz / luz.length) * 100) : 0

  const egresos = (ultimosEgresos ?? []) as { monto: number; concepto: string; fecha: string }[]

  const nombrePeriodo = nombreMesAnio(periodo.mes, periodo.anio)

  const doc = new PDFDocument({ margin: 0, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const pdfPromise = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  encabezado(doc, `Período: ${nombrePeriodo}`)

  const margin = 40
  const colW = (doc.page.width - margin * 2 - 16) / 2

  const altoLuz = tarjeta(doc, margin, doc.y, colW, '⚡ Cuenta de Luz', [
    ['Facturado', $(facturadoLuz)],
    ['Recaudado', $(recaudadoLuz), VERDE],
    ['Cuentas al día', `${pagadasLuz} / ${luz.length}`],
    ...(enMoraLuz > 0 ? [['En mora', String(enMoraLuz), ROJO] as [string, string, string]] : []),
  ])
  const altoGC = tarjeta(doc, margin + colW + 16, doc.y, colW, '🏘️ Gastos Comunes', periodoGC ? [
    ['Facturado', $(facturadoGC)],
    ['Recaudado', $(recaudadoGC), VERDE],
    ['Cuentas al día', `${pagadasGC} / ${gcRows.length}`],
  ] : [['Estado', 'Sin período este mes', GRIS]])

  const yTrasTarjetas = doc.y + Math.max(altoLuz, altoGC) + 24
  doc.y = yTrasTarjetas

  barra(doc, margin, doc.y, colW, pctLecturas, '📸 Lecturas subidas')
  barra(doc, margin + colW + 16, doc.y, colW, pctPagadasLuz, '💳 Cuentas al día (luz)')
  doc.y += 40

  doc.roundedRect(margin, doc.y, doc.page.width - margin * 2, 44, 6).fill('#eff6ff')
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(11).text('🏦 Saldo de caja actual', margin + 14, doc.y + 14)
  doc.fontSize(14).text($(saldoCajaActual), margin, doc.y + 12, { width: doc.page.width - margin * 2 - 14, align: 'right' })
  doc.y += 44 + 24
  doc.fillColor('#000').font('Helvetica')

  doc.font('Helvetica-Bold').fontSize(12).text('Últimos gastos registrados en caja', margin, doc.y)
  doc.moveDown(0.4)
  doc.font('Helvetica').fontSize(9.5)
  if (egresos.length === 0) {
    doc.fillColor(GRIS).text('Sin egresos registrados todavía', margin)
  } else {
    for (const e of egresos) {
      const y = doc.y
      doc.fillColor(GRIS).text(new Date(e.fecha + 'T00:00:00').toLocaleDateString('es-CL'), margin, y, { width: 70 })
      doc.fillColor('#000').text(e.concepto, margin + 75, y, { width: doc.page.width - margin * 2 - 75 - 90 })
      doc.fillColor(ROJO).text($(Number(e.monto)), doc.page.width - margin - 90, y, { width: 90, align: 'right' })
      doc.moveDown(0.5)
    }
  }

  doc.fontSize(8).fillColor(GRIS)
    .text('Comité Macrolote COPOSA — Reporte generado automáticamente por el sistema', margin, doc.page.height - 40, { align: 'center', width: doc.page.width - margin * 2 })

  doc.end()
  return pdfPromise
}
