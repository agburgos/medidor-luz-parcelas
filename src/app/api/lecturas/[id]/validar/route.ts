import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Comité aprueba o rechaza una lectura enviada por el parcelero.
// Aprobar la deja confirmada (entra al prorrateo). Rechazar permite reenvío.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { accion, motivo, lectura_corregida } = await req.json()
  if (!['aprobar', 'rechazar'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const update: Record<string, unknown> = accion === 'aprobar'
    ? {
        estado_validacion: 'aprobada',
        confirmado: true,
        motivo_rechazo: null,
        // El comité puede corregir el número al aprobar (según lo que ve en la foto)
        ...(lectura_corregida != null && !isNaN(Number(lectura_corregida))
          ? { lectura_actual: Number(lectura_corregida) }
          : {}),
      }
    : {
        estado_validacion: 'rechazada',
        confirmado: false,
        motivo_rechazo: motivo || 'Foto ilegible o lectura inconsistente',
      }

  const { data, error } = await supabase
    .from('lecturas')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, accion === 'aprobar' ? 'aprobar_lectura' : 'rechazar_lectura', 'lectura', id, { motivo: accion === 'rechazar' ? motivo : undefined })

  return NextResponse.json(data)
}
