import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export async function GET() {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json({ luz: null, gc: null })

  const supabase = createServiceClient()

  const [{ data: cuentaLuz }, { data: cuentaGC }] = await Promise.all([
    supabase
      .from('cuentas_parcela')
      .select('id, monto_prorrateado, monto_pagado, estado, periodo_id, periodo:periodos_facturacion(mes,anio,monto_total_factura)')
      .eq('parcela_id', sesion.parcelaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('cuentas_gc')
      .select('id, monto, monto_pagado, estado, periodo_gc_id, periodo:periodos_gc(mes,anio,valor_mensual)')
      .eq('parcela_id', sesion.parcelaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  let luz = null
  if (cuentaLuz) {
    const periodo = cuentaLuz.periodo as unknown as { mes: number; anio: number; monto_total_factura: number }
    const { data: todasCuentasPeriodo } = await supabase
      .from('cuentas_parcela')
      .select('monto_pagado')
      .eq('periodo_id', cuentaLuz.periodo_id)
    const recaudado = (todasCuentasPeriodo ?? []).reduce((s: number, c: { monto_pagado: number }) => s + Number(c.monto_pagado), 0)
    luz = {
      etiqueta: periodo ? `${meses[periodo.mes - 1]} ${periodo.anio}` : null,
      saldo: Math.max(cuentaLuz.monto_prorrateado - cuentaLuz.monto_pagado, 0),
      estado: cuentaLuz.estado,
      totalFactura: periodo?.monto_total_factura ?? 0,
      recaudado,
      faltante: Math.max((periodo?.monto_total_factura ?? 0) - recaudado, 0),
    }
  }

  let gc = null
  if (cuentaGC) {
    const periodo = cuentaGC.periodo as unknown as { mes: number; anio: number }
    gc = {
      etiqueta: periodo ? `${meses[periodo.mes - 1]} ${periodo.anio}` : null,
      saldo: Math.max(cuentaGC.monto - cuentaGC.monto_pagado, 0),
      estado: cuentaGC.estado,
    }
  }

  return NextResponse.json({ luz, gc })
}
