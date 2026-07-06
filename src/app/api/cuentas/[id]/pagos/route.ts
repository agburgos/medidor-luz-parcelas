import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .eq('cuenta_id', id)
    .order('fecha', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Registrar un pago/abono: inserta el pago, recalcula monto_pagado y actualiza el estado
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await req.json()

  const monto = Number(body.monto)
  if (!monto || monto <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })

  const { data: cuenta } = await supabase
    .from('cuentas_parcela')
    .select('id, monto_prorrateado, monto_pagado')
    .eq('id', id)
    .single()
  if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

  const { error: pagoError } = await supabase.from('pagos').insert({
    cuenta_id: id,
    monto,
    fecha: body.fecha || new Date().toISOString().slice(0, 10),
    metodo: body.metodo || 'transferencia',
    observacion: body.observacion || null,
  })
  if (pagoError) return NextResponse.json({ error: pagoError.message }, { status: 400 })

  // Recalcular total pagado desde el libro de pagos
  const { data: pagos } = await supabase.from('pagos').select('monto').eq('cuenta_id', id)
  const totalPagado = (pagos ?? []).reduce((s: number, p: { monto: number }) => s + Number(p.monto), 0)

  const nuevoEstado = totalPagado >= cuenta.monto_prorrateado ? 'pagado' : 'pago_parcial'

  const { error: updError } = await supabase
    .from('cuentas_parcela')
    .update({
      monto_pagado: totalPagado,
      estado: nuevoEstado,
      fecha_pago: body.fecha || new Date().toISOString().slice(0, 10),
    })
    .eq('id', id)
  if (updError) return NextResponse.json({ error: updError.message }, { status: 400 })

  return NextResponse.json({
    monto_pagado: totalPagado,
    estado: nuevoEstado,
    saldo: Math.max(cuenta.monto_prorrateado - totalPagado, 0),
  })
}
