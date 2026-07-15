import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

function puedeAmbito(sesion: NonNullable<Awaited<ReturnType<typeof getSesion>>>, ambito: string) {
  if (ambito === 'tecnico') return esSuperadmin(sesion)
  return sesion.rol === 'comite'
}

// GET: lista los ítems (cifrados) de un ámbito. El servidor jamás los descifra.
export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const ambito = req.nextUrl.searchParams.get('ambito')
  if (!ambito || !puedeAmbito(sesion, ambito)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('boveda_items')
    .select('id, categoria, iv, datos_cifrados, created_at, updated_at')
    .eq('ambito', ambito)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

// POST: crea un ítem cifrado (el cliente ya cifró {titulo, usuario, secreto, notas, url})
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { ambito, categoria, iv, datos_cifrados } = body

  if (!ambito || !puedeAmbito(sesion, ambito)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  if (!iv || !datos_cifrados) return NextResponse.json({ error: 'Faltan datos cifrados' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('boveda_items')
    .insert({
      ambito,
      categoria: categoria || 'otro',
      iv,
      datos_cifrados,
      creado_por: sesion.userId,
    })
    .select('id, categoria, iv, datos_cifrados, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'crear_item_boveda', 'boveda_item', data.id, { ambito, categoria })
  return NextResponse.json(data)
}
