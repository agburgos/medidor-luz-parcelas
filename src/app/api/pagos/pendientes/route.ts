import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pagos')
    .select('*, cuenta:cuentas_parcela(id, monto_prorrateado, monto_pagado, parcela:parcelas(numero,nombre_dueno), periodo:periodos_facturacion(mes,anio))')
    .eq('estado', 'por_validar')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
