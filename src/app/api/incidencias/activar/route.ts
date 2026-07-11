import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'
import { notificarIncidencia } from '@/lib/incidenciasNotificar'

const CATEGORIAS_VALIDAS = ['intruso', 'emergencia_medica', 'incendio', 'otro']
const LIMITE_MENSUAL = 2

// Activa una alerta de pánico: crea el registro y dispara notificaciones
// (email a parceleros + portería, WhatsApp si está configurado) de inmediato.
// No hay espera antes de enviar: una alerta real no puede depender de que el
// usuario mantenga la app abierta. Para corregir un error, existe /cancelar.
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json({ error: 'Sin parcela vinculada' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const categoria = CATEGORIAS_VALIDAS.includes(body.categoria) ? body.categoria : 'otro'
  const descripcion = typeof body.descripcion === 'string' ? body.descripcion.slice(0, 1000) : null
  const latitud = typeof body.latitud === 'number' ? body.latitud : null
  const longitud = typeof body.longitud === 'number' ? body.longitud : null

  const supabase = createServiceClient()

  // Límite anti-spam: máximo N activaciones por parcela en el mes calendario actual
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('incidencias')
    .select('*', { count: 'exact', head: true })
    .eq('parcela_id', sesion.parcelaId)
    .gte('fecha_activacion', inicioMes.toISOString())

  if ((count ?? 0) >= LIMITE_MENSUAL) {
    return NextResponse.json(
      { error: `Se alcanzó el límite de ${LIMITE_MENSUAL} alertas de pánico este mes para tu parcela. Si es una emergencia real, llama directamente a Carabineros (133), Ambulancia (131) o Bomberos (132).` },
      { status: 429 }
    )
  }

  const { data: incidencia, error } = await supabase
    .from('incidencias')
    .insert({
      parcela_id: sesion.parcelaId,
      usuario_id: sesion.userId,
      categoria,
      descripcion,
      latitud,
      longitud,
      estado: 'activa',
    })
    .select('id')
    .single()

  if (error || !incidencia) {
    return NextResponse.json({ error: error?.message || 'Error creando la incidencia' }, { status: 400 })
  }

  const resultado = await notificarIncidencia(incidencia.id, 'activacion')

  await supabase
    .from('incidencias')
    .update({ notificaciones_enviadas: resultado })
    .eq('id', incidencia.id)

  await registrar(sesion, 'activar_panico', 'incidencia', incidencia.id, { categoria })

  return NextResponse.json({ id: incidencia.id, notificaciones: resultado })
}
