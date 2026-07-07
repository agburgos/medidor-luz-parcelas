import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, puedeEditarParcela } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const parcelaId = req.nextUrl.searchParams.get('parcela_id')

  let query = supabase
    .from('mascotas')
    .select('*, parcela:parcelas(numero,nombre_dueno)')
    .order('created_at')

  if (sesion.rol === 'parcelero') {
    if (!sesion.parcelaId) return NextResponse.json([])
    query = query.eq('parcela_id', sesion.parcelaId)
  } else if (parcelaId) {
    query = query.eq('parcela_id', parcelaId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const parcela_id = sesion.rol === 'parcelero' ? sesion.parcelaId : body.parcela_id
  if (!parcela_id || !puedeEditarParcela(sesion, parcela_id)) {
    return NextResponse.json({ error: 'Parcela no válida' }, { status: 403 })
  }
  if (!body.nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('mascotas')
    .insert({
      parcela_id,
      nombre: body.nombre,
      especie: body.especie || 'perro',
      raza: body.raza || null,
      color: body.color || null,
      chip: body.chip || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
