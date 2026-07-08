import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// GET: estado de resultados consolidado (ingresos, gastos, resultado neto)
// Accesible para todos los parceleros (datos de la comunidad, no personales)
export async function GET() {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()

  // Obtener movimientos de caja categorizados
  const { data: movimientos, error: errMov } = await supabase
    .from('caja_movimientos')
    .select('id, tipo, concepto, monto, fecha, esPago')

  if (errMov) return NextResponse.json({ error: errMov.message }, { status: 400 })

  type Movimiento = { tipo: string; concepto: string; monto: number; fecha: string; esPago: boolean }
  const mov = (movimientos ?? []) as Movimiento[]

  // Clasificar ingresos y gastos
  const ingresos: { [key: string]: number } = {
    recaudacion_luz: 0,
    recaudacion_gc: 0,
    otros_ingresos: 0,
  }
  const gastos: { [key: string]: number } = {
    pago_compania: 0,
    mantenimiento: 0,
    administracion: 0,
    otros_gastos: 0,
  }

  for (const m of mov) {
    if (m.esPago) continue // No contar pagos en resultado, ya están en ingresos

    if (m.tipo === 'ingreso') {
      if (m.concepto.includes('Recaudación Luz') || m.concepto.includes('luz')) ingresos.recaudacion_luz += m.monto
      else if (m.concepto.includes('Gastos Comunes') || m.concepto.includes('GC')) ingresos.recaudacion_gc += m.monto
      else ingresos.otros_ingresos += m.monto
    } else if (m.tipo === 'egreso') {
      if (m.concepto.includes('Compañía') || m.concepto.includes('Pago') || m.concepto.includes('Factura')) gastos.pago_compania += m.monto
      else if (m.concepto.includes('Mantenimiento') || m.concepto.includes('Reparación')) gastos.mantenimiento += m.monto
      else if (m.concepto.includes('Admin') || m.concepto.includes('Administración')) gastos.administracion += m.monto
      else gastos.otros_gastos += m.monto
    }
  }

  const totalIngresos = Object.values(ingresos).reduce((s, v) => s + v, 0)
  const totalGastos = Object.values(gastos).reduce((s, v) => s + v, 0)
  const resultadoNeto = totalIngresos - totalGastos

  return NextResponse.json({
    periodo: new Date().toLocaleDateString('es-CL'),
    ingresos: { detalles: ingresos, total: totalIngresos },
    gastos: { detalles: gastos, total: totalGastos },
    resultadoNeto,
  })
}
