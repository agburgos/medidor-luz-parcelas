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
      .select('id, descripcion, monto, monto_pagado, estado, fecha_origen')
      .eq('parcela_id', sesion.parcelaId)
      .eq('tipo', 'luz')
      .not('estado', 'in', '(pagado,en_revision)'),
  ])

  type MoraLuz = { id: string; monto: number; monto_pagado: number; fecha_origen: string | null }
  const morasPendientes = (morasLuz ?? []) as unknown as MoraLuz[]
  const saldoDe = (m: MoraLuz) => Number(m.monto) - Number(m.monto_pagado)

  type CuentaLuz = { id: string; monto_prorrateado: number; monto_pagado: number; estado: string; periodo_id: string; periodo: { mes: number; anio: number; monto_total_factura: number } }
  const todas = (cuentasLuz ?? []) as unknown as CuentaLuz[]
  const pendientes = todas.filter(c => c.monto_prorrateado - c.monto_pagado > 0)

  // La cuota que corresponde a cada período es la mora cuya fecha_origen cae en
  // el mismo mes/año de ese período (p. ej. la cuota de julio de una repactación
  // solo se suma a la cuenta de julio, no a todas). Las moras sin fecha_origen,
  // o cuyo mes no calza con ningún período pendiente, quedan como "otras deudas".
  const cuotaDelPeriodo = (c: CuentaLuz) => morasPendientes
    .filter(m => {
      if (!m.fecha_origen) return false
      const f = new Date(m.fecha_origen + 'T00:00:00')
      return f.getMonth() + 1 === c.periodo.mes && f.getFullYear() === c.periodo.anio
    })
    .reduce((s, m) => s + saldoDe(m), 0)
  const idsAsignadas = new Set(
    pendientes.flatMap(c => morasPendientes.filter(m => {
      if (!m.fecha_origen) return false
      const f = new Date(m.fecha_origen + 'T00:00:00')
      return f.getMonth() + 1 === c.periodo.mes && f.getFullYear() === c.periodo.anio
    }).map(m => m.id))
  )
  const otrasDeudas = morasPendientes.filter(m => !idsAsignadas.has(m.id)).reduce((s, m) => s + saldoDe(m), 0)

  let luz = null
  if (pendientes.length > 0 || otrasDeudas > 0) {
    // La más antigua sin pagar es la que se muestra como referencia principal y
    // a la que se aplica el próximo pago informado, pero el saldo sumado incluye
    // TODOS los períodos pendientes (puede haber más de uno abierto a la vez)
    // MÁS las cuotas/deudas correspondientes — el parcelero sube un solo
    // comprobante que debe cubrir la cuenta de ese período + su cuota, si tiene.
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
    const deudaMoras = pendientes.reduce((s, c) => s + cuotaDelPeriodo(c), 0) + otrasDeudas
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
        saldo: c.monto_prorrateado - c.monto_pagado + cuotaDelPeriodo(c),
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
