import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

export async function GET() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('config_alertas')
    .select('*, comunidad:comunidades(nombre)')
    .limit(1)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await req.json()

  const update = {
    alertas_activas: !!body.alertas_activas,
    alerta_no_pago: !!body.alerta_no_pago,
    alerta_corte: !!body.alerta_corte,
    alerta_asamblea: !!body.alerta_asamblea,
    alerta_votacion: !!body.alerta_votacion,
    modo_pruebas: !!body.modo_pruebas,
    email_pruebas: String(body.email_pruebas || 'agarridob@gmail.com').trim(),
    whatsapp_pruebas: body.whatsapp_pruebas ? String(body.whatsapp_pruebas).trim() : null,
    organizador_reunion_email: String(body.organizador_reunion_email || 'agarridob@gmail.com').trim(),
    dias_aviso_vencimiento: Math.max(0, Number(body.dias_aviso_vencimiento ?? 5)),
    dias_aviso_corte: Math.max(0, Number(body.dias_aviso_corte ?? 3)),
    frecuencia_reenvio_dias: Math.max(0, Number(body.frecuencia_reenvio_dias ?? 0)),
    max_por_dia: Math.max(1, Number(body.max_por_dia ?? 200)),
    dia_tope_lectura: Math.min(28, Math.max(1, Number(body.dia_tope_lectura ?? 10))),
    avisar_lectura_dias_antes: Math.max(0, Number(body.avisar_lectura_dias_antes ?? 3)),
    porteria_email: body.porteria_email ? String(body.porteria_email).trim() : null,
    porteria_whatsapp: body.porteria_whatsapp ? String(body.porteria_whatsapp).trim() : null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('config_alertas')
    .update(update)
    .eq('comunidad_id', body.comunidad_id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
