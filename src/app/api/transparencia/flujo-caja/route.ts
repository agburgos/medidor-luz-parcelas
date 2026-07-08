import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// GET: flujo de caja histórico por período
export async function GET() {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()

  // Obtener todos los movimientos de caja
  const { data: movimientos, error: errMov } = await supabase
    .from('caja_movimientos')
    .select('id, tipo, concepto, monto, fecha, periodo_id')
    .order('fecha', { ascending: true })

  if (errMov) return NextResponse.json({ error: errMov.message }, { status: 400 })

  // Agrupar por mes/año
  const periodoMap: Record<string, { ingresos: number; gastos: number }> = {}

  for (const mov of movimientos || []) {
    const fecha = new Date(mov.fecha)
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`

    if (!periodoMap[key]) {
      periodoMap[key] = { ingresos: 0, gastos: 0 }
    }

    if (mov.tipo === 'ingreso') {
      periodoMap[key].ingresos += Number(mov.monto)
    } else if (mov.tipo === 'egreso') {
      periodoMap[key].gastos += Number(mov.monto)
    }
  }

  // Convertir a array y ordenar
  const resultado = Object.entries(periodoMap)
    .map(([key, valores]) => {
      const [anio, mes] = key.split('-')
      return {
        mes: parseInt(mes),
        anio: parseInt(anio),
        ingresos: Math.round(valores.ingresos),
        gastos: Math.round(valores.gastos),
        flujo: Math.round(valores.ingresos - valores.gastos),
      }
    })
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)

  return NextResponse.json(resultado)
}
