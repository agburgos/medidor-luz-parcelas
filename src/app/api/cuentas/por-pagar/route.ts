import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// Obtener cuentas pendientes de pago (solo para comité)
export async function GET() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Obtener cuentas con saldo pendiente
  const { data, error } = await supabase
    .from('cuentas_parcela')
    .select('id, monto_prorrateado, monto_pagado, estado, parcela:parcelas(numero, nombre_dueno), periodo:periodos_facturacion(mes, anio)')
    .or('estado.eq.pendiente,estado.eq.pago_parcial')
    .order('periodo_id', { ascending: false })
    .order('parcela_id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data || [])
}
