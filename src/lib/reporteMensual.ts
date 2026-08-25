import PDFDocument from 'pdfkit'
import { createServiceClient } from '@/lib/supabase/server'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

// Arma el reporte mensual de transparencia (recaudación, gastos, saldo de caja
// y estado de las cuentas) en PDF, para descarga manual o envío automático.
export async function generarReporteMensualPDF(mes: number, anio: number): Promise<Buffer> {
  const supabase = createServiceClient()

  const [
    { data: periodoLuz },
    { data: periodoGC },
    { data: cuentasLuz },
    { data: cuentasGC },
    { data: movimientos },
    { data: saldoInicialRow },
    { data: todosMovimientos },
  ] = await Promise.all([
    supabase.from('periodos_facturacion').select('*').eq('mes', mes).eq('anio', anio).maybeSingle(),
    supabase.from('periodos_gc').select('*').eq('mes', mes).eq('anio', anio).maybeSingle(),
    supabase.from('cuentas_parcela').select('monto_prorrateado, monto_pagado, estado, periodo:periodos_facturacion!inner(mes,anio)').eq('periodo.mes', mes).eq('periodo.anio', anio),
    supabase.from('cuentas_gc').select('monto, monto_pagado, estado, periodo:periodos_gc!inner(mes,anio)').eq('periodo.mes', mes).eq('periodo.anio', anio),
    supabase.from('caja_movimientos').select('tipo, monto, concepto, fecha').gte('fecha', `${anio}-${String(mes).padStart(2, '0')}-01`).lt('fecha', mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`),
    supabase.from('caja_saldos').select('saldo_final').order('fecha', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('caja_movimientos').select('tipo, monto'),
  ])

  type Cuenta = { monto_prorrateado?: number; monto?: number; monto_pagado: number; estado: string }
  const luz = (cuentasLuz ?? []) as Cuenta[]
  const gc = (cuentasGC ?? []) as Cuenta[]
  const movs = (movimientos ?? []) as { tipo: string; monto: number; concepto: string; fecha: string }[]

  const recaudadoLuz = luz.reduce((s, c) => s + Number(c.monto_pagado), 0)
  const recaudadoGC = gc.reduce((s, c) => s + Number(c.monto_pagado), 0)
  const facturadoLuz = luz.reduce((s, c) => s + Number(c.monto_prorrateado ?? 0), 0)
  const facturadoGC = gc.reduce((s, c) => s + Number(c.monto ?? 0), 0)
  const pagadasLuz = luz.filter(c => c.estado === 'pagado').length
  const pagadasGC = gc.filter(c => c.estado === 'pagado').length

  const ingresosMes = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
  const egresosMes = movs.filter(m => m.tipo === 'egreso')
  const totalEgresosMes = egresosMes.reduce((s, m) => s + Number(m.monto), 0)

  const SALDO_INICIAL = saldoInicialRow?.saldo_final ?? 0
  const todos = (todosMovimientos ?? []) as { tipo: string; monto: number }[]
  const saldoCajaActual = SALDO_INICIAL
    + todos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
    - todos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)

  const doc = new PDFDocument({ margin: 40, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const pdfPromise = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  const nombreMes = `${MESES[mes - 1]} ${anio}`

  doc.fontSize(18).fillColor('#1d4ed8').text('⚡ Macrolote COPOSA — Reporte mensual de transparencia')
  doc.fontSize(13).fillColor('#374151').text(nombreMes)
  doc.fontSize(9).fillColor('#9ca3af').text(`Generado: ${new Date().toLocaleString('es-CL')}`)
  doc.moveDown(1)

  doc.fontSize(13).fillColor('#000').text('Resumen del mes', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(10).fillColor('#000')
  if (periodoLuz) {
    doc.text(`Luz — Facturado: ${$(facturadoLuz)}  ·  Recaudado: ${$(recaudadoLuz)}  ·  Cuentas al día: ${pagadasLuz}/${luz.length}`)
  } else {
    doc.fillColor('#9ca3af').text('Luz — sin período facturado este mes')
  }
  doc.fillColor('#000')
  if (periodoGC) {
    doc.text(`Gastos Comunes — Facturado: ${$(facturadoGC)}  ·  Recaudado: ${$(recaudadoGC)}  ·  Cuentas al día: ${pagadasGC}/${gc.length}`)
  } else {
    doc.fillColor('#9ca3af').text('Gastos Comunes — sin período facturado este mes')
  }
  doc.fillColor('#000')
  doc.moveDown(0.5)
  doc.fontSize(11).text(`Ingresos de caja del mes: ${$(ingresosMes)}`)
  doc.text(`Egresos de caja del mes: ${$(totalEgresosMes)}`)
  doc.fontSize(12).fillColor('#1d4ed8').text(`Saldo de caja actual: ${$(saldoCajaActual)}`, { underline: false })
  doc.fillColor('#000')
  doc.moveDown(1)

  doc.fontSize(13).text('Detalle de gastos (egresos) del mes', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(9)
  if (egresosMes.length === 0) {
    doc.fillColor('#9ca3af').text('Sin egresos registrados este mes')
  } else {
    for (const m of egresosMes) {
      doc.fillColor('#000').text(`${new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-CL')}  —  ${m.concepto}  —  ${$(Number(m.monto))}`)
    }
  }

  doc.end()
  return pdfPromise
}

export function nombreMesAnio(mes: number, anio: number) {
  return `${MESES[mes - 1]} ${anio}`
}
