import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  // Obtener todas las parcelas
  const { data: parcelas } = await supabase
    .from('parcelas')
    .select('id, numero, nombre_dueno')
    .eq('activa', true)
    .eq('tiene_empalme', true)
    .order('numero')

  if (!parcelas) return NextResponse.json([])

  // Obtener las lecturas ya guardadas para este periodo
  const { data: lecturasExistentes } = await supabase
    .from('lecturas')
    .select('parcela_id, lectura_actual, lectura_anterior, estado, confirmado')
    .eq('periodo_id', id)

  type LecturaExistente = { parcela_id: string; lectura_actual: number; lectura_anterior: number; estado: string; confirmado: boolean }
  const lecturasMap = new Map<string, LecturaExistente>(lecturasExistentes?.map((l: LecturaExistente) => [l.parcela_id, l]))

  // Obtener periodo anterior para tener lectura_anterior por defecto
  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('mes, anio, monto_total_factura, fecha_vencimiento, prorrateo_calculado')
    .eq('id', id)
    .single()

  let ultimasLecturas: Map<string, number> = new Map()
  if (periodo) {
    // Buscar el período anterior más reciente que tenga lecturas registradas
    // (no asumir mes calendario consecutivo: puede haber períodos saltados)
    const { data: periodosAnteriores } = await supabase
      .from('periodos_facturacion')
      .select('id, mes, anio')
      .or(`anio.lt.${periodo.anio},and(anio.eq.${periodo.anio},mes.lt.${periodo.mes})`)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })

    for (const p of periodosAnteriores ?? []) {
      const { data: lecturasAnt } = await supabase
        .from('lecturas')
        .select('parcela_id, lectura_actual')
        .eq('periodo_id', p.id)
      if (lecturasAnt && lecturasAnt.length > 0) {
        ultimasLecturas = new Map(lecturasAnt.map((l: { parcela_id: string; lectura_actual: number }) => [l.parcela_id, l.lectura_actual]))
        break
      }
    }
  }

  type Parcela = { id: string; numero: number; nombre_dueno: string }
  const resultado = (parcelas as Parcela[]).map(p => {
    const existente = lecturasMap.get(p.id)
    return {
      parcela_id: p.id,
      numero: p.numero,
      nombre_dueno: p.nombre_dueno,
      lectura_anterior: existente?.lectura_anterior ?? ultimasLecturas.get(p.id) ?? 0,
      lectura_actual: existente?.lectura_actual ?? null,
      estado: existente?.estado ?? 'normal',
      guardado: !!existente,
    }
  })

  return NextResponse.json({
    filas: resultado,
    periodo: {
      montoTotalFactura: periodo?.monto_total_factura ?? 0,
      fechaVencimiento: periodo?.fecha_vencimiento ?? null,
      prorrateoCalculado: !!periodo?.prorrateo_calculado,
    },
  })
}
