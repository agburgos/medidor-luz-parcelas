import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'
import { enviarCorreoEvento } from '@/lib/emailAlertas'

export async function GET() {
  const sesion = await getSesion()
  const supabase = createServiceClient()
  let query = supabase.from('asambleas').select('*').order('fecha', { ascending: false })
  if (sesion?.rol !== 'comite') query = query.neq('tipo', 'directiva')
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Las "privadas" (conversación con un vecino puntual) solo se muestran al comité
  // y a la(s) parcela(s) citada(s) — al resto de parceleros no se les debe listar.
  if (sesion?.rol !== 'comite') {
    const privadas = (data ?? []).filter((a: { tipo: string }) => a.tipo === 'privada')
    if (privadas.length > 0) {
      const idsPermitidos = new Set<string>()
      if (sesion?.parcelaId) {
        const { data: asistencias } = await supabase
          .from('asamblea_asistentes')
          .select('asamblea_id')
          .in('asamblea_id', privadas.map((a: { id: string }) => a.id))
          .eq('parcela_id', sesion.parcelaId)
        for (const a of (asistencias ?? []) as { asamblea_id: string }[]) idsPermitidos.add(a.asamblea_id)
      }
      const filtrado = (data ?? []).filter((a: { id: string; tipo: string }) => a.tipo !== 'privada' || idsPermitidos.has(a.id))
      return NextResponse.json(filtrado)
    }
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await req.json()
  if (!body.titulo || !body.fecha) return NextResponse.json({ error: 'Título y fecha son requeridos' }, { status: 400 })

  const { data: comunidad } = await supabase.from('comunidades').select('id').eq('activa', true).limit(1).single()

  const { data, error } = await supabase
    .from('asambleas')
    .insert({
      comunidad_id: comunidad?.id ?? null,
      titulo: body.titulo,
      tipo: body.tipo || 'ordinaria',
      fecha: body.fecha,
      hora_inicio: body.hora_inicio || null,
      hora_termino: body.hora_termino || null,
      lugar: body.lugar || null,
      created_by: sesion.userId,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'crear_asamblea', 'asamblea', data.id, { titulo: body.titulo, fecha: body.fecha })

  // No notificar masivamente las de directiva ni las privadas (conversación puntual)
  if (data.tipo !== 'directiva' && data.tipo !== 'privada') {
    const fechaFmt = new Date(body.fecha + 'T00:00:00').toLocaleDateString('es-CL')
    await enviarCorreoEvento(
      'alerta_asamblea',
      `🗓️ Nueva asamblea citada: ${data.titulo}`,
      `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="color:#1d4ed8;">🗓️ Nueva asamblea citada</h2>
  <p><strong>${data.titulo}</strong></p>
  <p>Fecha: <strong>${fechaFmt}</strong>${data.hora_inicio ? ` a las <strong>${data.hora_inicio}</strong>` : ''}</p>
  ${data.lugar ? `<p>Lugar: <strong>${data.lugar}</strong></p>` : ''}
  <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/parcelero/asambleas" style="display:inline-block;background:#1d4ed8;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px;">Ver detalles</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Comité COPOSA</p>
</div>`
    )
  }

  return NextResponse.json(data)
}
