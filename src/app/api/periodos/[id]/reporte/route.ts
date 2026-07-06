import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ETIQUETAS_ESTADO: Record<string, string> = {
  normal: '',
  s_info: 'S/INFO',
  nuevo: 'NUEVO',
  saldo_af: 'SALDO A FAVOR',
  desconectado: 'DESCONECTADO',
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('*')
    .eq('id', id)
    .single()

  if (!periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })

  const [{ data: lecturas }, { data: cuentas }, { data: todasLecturas }] = await Promise.all([
    supabase
      .from('lecturas')
      .select('*, parcela:parcelas(id,numero,nombre_dueno,email)')
      .eq('periodo_id', id),
    supabase
      .from('cuentas_parcela')
      .select('parcela_id, monto_consumo, monto_cargo_fijo, monto_prorrateado, estado')
      .eq('periodo_id', id),
    // Todas las lecturas históricas confirmadas para calcular consumo acumulado
    supabase
      .from('lecturas')
      .select('parcela_id, consumo_kwh, estado, periodo:periodos_facturacion(anio,mes)')
      .eq('confirmado', true),
  ])

  if (!lecturas || lecturas.length === 0) {
    return NextResponse.json({ error: 'Sin lecturas para este período' }, { status: 400 })
  }

  type LecturaHist = { parcela_id: string; consumo_kwh: number; estado: string; periodo: { anio: number; mes: number } }
  // Acumulado: suma de consumos históricos hasta este período inclusive
  const limite = periodo.anio * 100 + periodo.mes
  const acumulados = new Map<string, number>()
  for (const l of (todasLecturas ?? []) as LecturaHist[]) {
    const clave = l.periodo ? l.periodo.anio * 100 + l.periodo.mes : 0
    if (clave <= limite && l.estado === 'normal' && l.consumo_kwh > 0) {
      acumulados.set(l.parcela_id, (acumulados.get(l.parcela_id) ?? 0) + Number(l.consumo_kwh))
    }
  }

  const cuentasMap = new Map(cuentas?.map((c: { parcela_id: string }) => [c.parcela_id, c]) ?? [])

  type LecturaFila = {
    parcela: { id: string; numero: number; nombre_dueno: string; email: string | null }
    lectura_anterior: number
    lectura_actual: number
    consumo_kwh: number
    estado: string
  }

  const filas = (lecturas as unknown as LecturaFila[])
    .sort((a, b) => a.parcela.numero - b.parcela.numero)
    .map(l => {
      const cuenta = cuentasMap.get(l.parcela.id) as { monto_consumo: number; monto_cargo_fijo: number; monto_prorrateado: number; estado: string } | undefined
      return {
        numero: l.parcela.numero,
        nombre: l.parcela.nombre_dueno,
        email: l.parcela.email,
        lectura_anterior: l.lectura_anterior,
        lectura_actual: l.lectura_actual,
        consumo_kwh: l.estado === 'normal' ? l.consumo_kwh : 0,
        consumo_acumulado: acumulados.get(l.parcela.id) ?? 0,
        estado_lectura: ETIQUETAS_ESTADO[l.estado] ?? '',
        monto_consumo: cuenta?.monto_consumo ?? 0,
        monto_cargo_fijo: cuenta?.monto_cargo_fijo ?? 0,
        total_pagar: cuenta?.monto_prorrateado ?? 0,
        estado_pago: cuenta?.estado ?? 'sin_cuenta',
      }
    })

  const totalKwh = filas.reduce((s, f) => s + Number(f.consumo_kwh), 0)
  const totalCobrado = filas.reduce((s, f) => s + f.total_pagar, 0)
  const consumoGeneral = periodo.lectura_general_actual != null && periodo.lectura_general_anterior != null
    ? periodo.lectura_general_actual - periodo.lectura_general_anterior
    : null

  return NextResponse.json({
    periodo: {
      mes: periodo.mes,
      anio: periodo.anio,
      fecha_vencimiento: periodo.fecha_vencimiento,
      fecha_corte: periodo.fecha_corte,
      costo_unitario_kwh: periodo.costo_unitario_kwh,
      cargo_fijo: periodo.cargo_fijo,
      monto_total_factura: periodo.monto_total_factura,
      lectura_general_anterior: periodo.lectura_general_anterior,
      lectura_general_actual: periodo.lectura_general_actual,
    },
    filas,
    resumen: {
      total_kwh: totalKwh,
      total_cobrado: totalCobrado,
      excedente: totalCobrado - (periodo.monto_total_factura ?? 0),
      consumo_general_kwh: consumoGeneral,
      perdida_kwh: consumoGeneral != null ? consumoGeneral - totalKwh : null,
      parcelas_con_consumo: filas.filter(f => Number(f.consumo_kwh) > 0).length,
      parcelas_total: filas.length,
    },
  })
}
