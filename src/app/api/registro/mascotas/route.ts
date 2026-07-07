import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, puedeEditarParcela } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const parcelaIdQuery = req.nextUrl.searchParams.get('parcela_id')
  const todas = req.nextUrl.searchParams.get('todas') === '1'

  let query = supabase
    .from('mascotas')
    .select('*, parcela:parcelas(numero,nombre_dueno)')
    .order('created_at')

  if (parcelaIdQuery) {
    query = query.eq('parcela_id', parcelaIdQuery)
  } else if (todas) {
    if (sesion.rol !== 'comite') return NextResponse.json([])
  } else {
    if (!sesion.parcelaId) return NextResponse.json([])
    query = query.eq('parcela_id', sesion.parcelaId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const parcela_id = body.parcela_id || sesion.parcelaId
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
