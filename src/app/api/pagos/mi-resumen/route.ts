import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export async function GET() {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json({ luz: null, gc: null })

  const supabase = createServiceClient()

  const [{ data: cuentasLuz }, { data: cuentaGC }, { data: morasLuz }] = await Promise.all([
    supabase
      .from('cuentas_parcela')
      .select('id, monto_prorrateado, monto_pagado, estado, periodo_id, periodo:periodos_facturacion(mes,anio,monto_total_factura)')
      .eq('parcela_id', sesion.parcelaId)
      .neq('estado', 'desconectado')
      .order('created_at', { ascending: true }),
    supabase
      .from('cuentas_gc')
      .select('id, monto, monto_pagado, estado, periodo_gc_id, periodo:periodos_gc(mes,anio,valor_mensual)')
      .eq('parcela_id', sesion.parcelaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('moras_anteriores')
      .select('id, descripcion, monto, monto_pagado, estado')
      .eq('parcela_id', sesion.parcelaId)
      .eq('tipo', 'luz')
      .not('estado', 'in', '(pagado,en_revision)'),
  ])

  const deudaMoras = (morasLuz ?? []).reduce((s: number, m: { monto: number; monto_pagado: number }) => s + (Number(m.monto) - Number(m.monto_pagado)), 0)

  type CuentaLuz = { id: string; monto_prorrateado: number; monto_pagado: number; estado: string; periodo_id: string; periodo: { mes: number; anio: number; monto_total_factura: number } }
  const todas = (cuentasLuz ?? []) as unknown as CuentaLuz[]
  const pendientes = todas.filter(c => c.monto_prorrateado - c.monto_pagado > 0)

  let luz = null
  if (pendientes.length > 0 || deudaMoras > 0) {
    // La más antigua sin pagar es la que se muestra como referencia principal y
    // a la que se aplica el próximo pago informado, pero el saldo sumado incluye
    // TODOS los períodos pendientes (puede haber más de uno abierto a la vez)
    // MÁS las deudas anteriores (moras, repactaciones, etc.) — el parcelero sube
    // un solo comprobante que debe cubrir todo junto.
    const masAntigua = pendientes[0]
    const periodo = masAntigua?.periodo
    let recaudado = 0
    if (masAntigua) {
      const { data: todasCuentasPeriodo } = await supabase
        .from('cuentas_parcela')
        .select('monto_pagado')
        .eq('periodo_id', masAntigua.periodo_id)
      recaudado = (todasCuentasPeriodo ?? []).reduce((s: number, c: { monto_pagado: number }) => s + Number(c.monto_pagado), 0)
    }
    const saldoCuentas = pendientes.reduce((s, c) => s + (c.monto_prorrateado - c.monto_pagado), 0)
    const saldoTotal = saldoCuentas + deudaMoras
    const etiquetaPeriodos = periodo ? `${meses[periodo.mes - 1]} ${periodo.anio}` : null
    luz = {
      etiqueta: pendientes.length > 1
        ? `${etiquetaPeriodos} + ${pendientes.length - 1} período${pendientes.length > 2 ? 's' : ''} más`
        : etiquetaPeriodos,
      saldo: saldoTotal,
      saldoCuentas,
      deudaMoras,
      estado: masAntigua?.estado ?? 'pendiente',
      totalFactura: periodo?.monto_total_factura ?? 0,
      recaudado,
      faltante: Math.max((periodo?.monto_total_factura ?? 0) - recaudado, 0),
      pendientes: pendientes.map(c => ({
        cuenta_id: c.id,
        etiqueta: `${meses[c.periodo.mes - 1]} ${c.periodo.anio}`,
        saldo: c.monto_prorrateado - c.monto_pagado,
      })),
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
