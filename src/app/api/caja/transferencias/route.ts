import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'
import { cargarCuentasConSaldo } from '@/lib/caja'

// Transferencia interna entre cuentas de caja: crea dos movimientos ligados por
// transferencia_id (egreso en el origen, ingreso en el destino). No es ingreso
// ni gasto real de la comunidad: el total no cambia.
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const fd = await req.formData()
  const origenId = fd.get('origen_id') as string
  const destinoId = fd.get('destino_id') as string
  const monto = Number(fd.get('monto'))
  const fecha = fd.get('fecha') as string
  const observacion = (fd.get('observacion') as string) || null
  const documento = fd.get('documento') as File | null

  if (!origenId || !destinoId || !fecha || !monto || monto <= 0) {
    return NextResponse.json({ error: 'Origen, destino, monto y fecha son requeridos' }, { status: 400 })
  }
  if (origenId === destinoId) return NextResponse.json({ error: 'El origen y el destino deben ser distintos' }, { status: 400 })

  const { cuentas } = await cargarCuentasConSaldo()
  const origen = cuentas.find(c => c.id === origenId)
  const destino = cuentas.find(c => c.id === destinoId)
  if (!origen || !destino) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 400 })
  if (origen.saldo < monto) {
    return NextResponse.json({ error: `"${origen.nombre}" no tiene saldo suficiente (disponible $${Math.round(origen.saldo).toLocaleString('es-CL')})` }, { status: 400 })
  }

  const supabase = createServiceClient()
  let documento_url: string | null = null
  if (documento && documento.size > 0) {
    const ruta = `caja/${Date.now()}-${documento.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const { error: errUpload } = await supabase.storage.from('archivos').upload(ruta, await documento.arrayBuffer(), { contentType: documento.type })
    if (errUpload) return NextResponse.json({ error: `Error al subir documento: ${errUpload.message}` }, { status: 400 })
    documento_url = ruta
  }

  const transferencia_id = randomUUID()
  const base = { fecha, monto, observacion, documento_url, usuario_id: sesion.userId, transferencia_id }
  const { error } = await supabase.from('caja_movimientos').insert([
    { ...base, tipo: 'egreso', cuenta_id: origenId, concepto: `Transferencia interna a ${destino.nombre}` },
    { ...base, tipo: 'ingreso', cuenta_id: destinoId, concepto: `Transferencia interna desde ${origen.nombre}` },
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'transferencia_interna_caja', 'caja', transferencia_id, {
    origen: origen.nombre, destino: destino.nombre, monto, fecha,
  })
  return NextResponse.json({ ok: true, transferencia_id })
}
