import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// POST: Cargar consumos históricos desde JSON
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { consumos, mes, anio, periodo_descripcion } = await req.json()

  if (!Array.isArray(consumos) || !mes || !anio) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  // Validar estructura de consumos
  const validos = consumos.filter((c: any) => c.parcela_id && typeof c.kwh === 'number')
  if (validos.length === 0) {
    return NextResponse.json({ error: 'No hay datos válidos para cargar' }, { status: 400 })
  }

  // Preparar datos para insertar
  const datos = validos.map((c: any) => ({
    parcela_id: c.parcela_id,
    mes,
    anio,
    kwh: c.kwh,
    lectura_anterior: c.lectura_anterior || null,
    lectura_actual: c.lectura_actual || null,
    periodo_descripcion: periodo_descripcion || null,
    cargado_por: sesion.userId,
  }))

  // Borrar históricos anteriores del mismo mes/año antes de insertar
  await supabase
    .from('consumo_historico')
    .delete()
    .eq('mes', mes)
    .eq('anio', anio)

  // Insertar
  const { data, error } = await supabase
    .from('consumo_historico')
    .insert(datos)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await registrar(sesion, 'cargar_consumo_historico', 'consumo_historico', `${mes}-${anio}`, {
    cantidad: data?.length || 0,
    mes,
    anio,
  })

  return NextResponse.json({
    success: true,
    cantidad: data?.length || 0,
    periodo: `${mes}/${anio}`,
  })
}

// GET: Listar consumos históricos
export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('consumo_historico')
    .select('mes, anio, COUNT(*) as cantidad')
    .group_by('mes,anio')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}
