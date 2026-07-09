import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// Lista los emails de los miembros del comité (para invitarlos a reuniones de directiva).
export async function GET() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre, cargo').eq('rol', 'comite')
  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 500 })

  const emailPorId = new Map((authList?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email]))

  const miembros = (perfiles ?? [])
    .map((p: { id: string; nombre: string | null; cargo: string | null }) => ({
      nombre: p.nombre,
      cargo: p.cargo,
      email: emailPorId.get(p.id) ?? null,
    }))
    .filter((m: { email: string | null }) => !!m.email)

  return NextResponse.json(miembros)
}
