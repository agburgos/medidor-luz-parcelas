import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('caja_movimientos')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const { tipo, concepto, monto, fecha, documento_url, observacion } = body

  if (!tipo || !concepto || !monto || !fecha) {
    return NextResponse.json({ error: 'Tipo, concepto, monto y fecha son requeridos' }, { status: 400 })
  }
  if (!['ingreso', 'egreso'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo debe ser ingreso o egreso' }, { status: 400 })
  }
  if (Number(monto) <= 0) {
    return NextResponse.json({ error: 'Monto debe ser positivo' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('caja_movimientos')
    .insert({
      tipo,
      concepto,
      monto: Number(monto),
      fecha,
      documento_url: documento_url || null,
      observacion: observacion || null,
      usuario_id: sesion.userId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'registrar_movimiento_caja', 'caja', data.id, {
    tipo, concepto, monto: Number(monto), fecha,
  })

  return NextResponse.json(data)
}
