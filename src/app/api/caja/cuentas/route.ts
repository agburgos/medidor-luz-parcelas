import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'
import { cargarCuentasConSaldo } from '@/lib/caja'

// Saldos por cuenta: lectura para comité y para parceleros (transparencia).
export async function GET() {
  const sesion = await getSesion()
  if (!sesion || (sesion.rol !== 'comite' && !sesion.parcelaId)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  return NextResponse.json(await cargarCuentasConSaldo())
}

export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { nombre } = await req.json()
  const limpio = String(nombre ?? '').trim()
  if (!limpio) return NextResponse.json({ error: 'El nombre de la cuenta es requerido' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: existentes } = await supabase.from('caja_cuentas').select('nombre, orden')
  if ((existentes ?? []).some((c: { nombre: string }) => c.nombre.toLowerCase() === limpio.toLowerCase())) {
    return NextResponse.json({ error: 'Ya existe una cuenta con ese nombre' }, { status: 400 })
  }
  const orden = Math.max(0, ...(existentes ?? []).map((c: { orden: number }) => c.orden)) + 1
  const { data, error } = await supabase.from('caja_cuentas').insert({ nombre: limpio, tipo: 'otra', orden }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'crear_cuenta_caja', 'caja_cuenta', data.id, { nombre: limpio })
  return NextResponse.json(data)
}
