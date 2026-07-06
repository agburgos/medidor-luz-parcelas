import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  // Obtener todas las parcelas
  const { data: parcelas } = await supabase
    .from('parcelas')
    .select('id, numero, nombre_dueno')
    .order('numero')

  if (!parcelas) return NextResponse.json([])

  // Obtener las lecturas ya guardadas para este periodo
  const { data: lecturasExistentes } = await supabase
    .from('lecturas')
    .select('parcela_id, lectura_actual, lectura_anterior, confirmado')
    .eq('periodo_id', id)

  type LecturaExistente = { parcela_id: string; lectura_actual: number; lectura_anterior: number; confirmado: boolean }
  const lecturasMap = new Map<string, LecturaExistente>(lecturasExistentes?.map((l: LecturaExistente) => [l.parcela_id, l]))

  // Obtener periodo anterior para tener lectura_anterior por defecto
  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('mes, anio')
    .eq('id', id)
    .single()

  let ultimasLecturas: Map<string, number> = new Map()
  if (periodo) {
    // Buscar periodo anterior
    const fechaAnterior = new Date(periodo.anio, periodo.mes - 2)
    const { data: periodoAnterior } = await supabase
      .from('periodos_facturacion')
      .select('id')
      .eq('mes', fechaAnterior.getMonth() + 1)
      .eq('anio', fechaAnterior.getFullYear())
      .single()

    if (periodoAnterior) {
      const { data: lecturasAnt } = await supabase
        .from('lecturas')
        .select('parcela_id, lectura_actual')
        .eq('periodo_id', periodoAnterior.id)
      ultimasLecturas = new Map(lecturasAnt?.map((l: { parcela_id: string; lectura_actual: number }) => [l.parcela_id, l.lectura_actual]))
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
      guardado: !!existente,
    }
  })

  return NextResponse.json(resultado)
}
