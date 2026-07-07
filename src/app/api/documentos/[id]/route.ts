import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: doc } = await supabase.from('documentos').select('nombre').eq('id', id).single()
  const { error } = await supabase.from('documentos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'eliminar_documento', 'documento', id, { nombre: doc?.nombre })
  return NextResponse.json({ eliminado: true })
}
