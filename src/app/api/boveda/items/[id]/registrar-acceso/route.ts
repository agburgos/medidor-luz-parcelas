import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'

function puedeAmbito(sesion: NonNullable<Awaited<ReturnType<typeof getSesion>>>, ambito: string) {
  if (ambito === 'tecnico') return esSuperadmin(sesion)
  return sesion.rol === 'comite'
}

const ACCIONES_VALIDAS = ['ver', 'copiar']

// Registra en la bitácora quién reveló/copió el secreto de un ítem (no su
// contenido, solo el hecho de que se accedió) — trazabilidad para una bóveda
// de claves compartida entre varias personas.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const accion = ACCIONES_VALIDAS.includes(body.accion) ? body.accion : 'ver'

  const supabase = createServiceClient()
  const { data: item } = await supabase.from('boveda_items').select('ambito').eq('id', id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 })
  if (!puedeAmbito(sesion, item.ambito)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await supabase.from('boveda_accesos').insert({ item_id: id, usuario_id: sesion.userId, accion })
  return NextResponse.json({ ok: true })
}
