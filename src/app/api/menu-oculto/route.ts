import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// Cualquier usuario autenticado puede leer qué opciones están ocultas,
// para que el menú se filtre igual sea comité o parcelero.
export async function GET() {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('menu_oculto').select('href')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ocultos: data.map(d => d.href) })
}

// Solo el comité puede ocultar/mostrar opciones del menú.
export async function PUT(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { href, oculto } = await req.json()
  if (!href) return NextResponse.json({ error: 'Falta href' }, { status: 400 })

  const supabase = createServiceClient()
  if (oculto) {
    const { error } = await supabase.from('menu_oculto').upsert({ href })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else {
    const { error } = await supabase.from('menu_oculto').delete().eq('href', href)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
