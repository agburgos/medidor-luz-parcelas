import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'
import { notificarIncidencia } from '@/lib/incidenciasNotificar'

// Marca una incidencia como falsa alarma / cancelada y envía un mensaje de
// retracción ("todo en orden") a los mismos destinatarios que recibieron la
// alerta original.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: incidencia } = await supabase
    .from('incidencias')
    .select('id, parcela_id, estado')
    .eq('id', id)
    .maybeSingle()

  if (!incidencia) return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 })

  const puedeCancelar = sesion.rol === 'comite' || sesion.parcelaId === incidencia.parcela_id
  if (!puedeCancelar) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  if (incidencia.estado === 'cancelado' || incidencia.estado === 'resuelto') {
    return NextResponse.json({ error: 'Esta incidencia ya fue cerrada' }, { status: 400 })
  }

  const { error } = await supabase
    .from('incidencias')
    .update({
      estado: 'cancelado',
      confirmado_falsa_alarma: true,
      fecha_resolucion: new Date().toISOString(),
      resuelto_por: sesion.userId,
      notas_resolucion: 'Falsa alarma — cancelada por quien la activó',
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const resultado = await notificarIncidencia(id, 'retraccion')
  await registrar(sesion, 'cancelar_panico', 'incidencia', id)

  return NextResponse.json({ ok: true, notificaciones: resultado })
}
