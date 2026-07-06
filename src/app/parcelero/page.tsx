import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EstadoBadge from '@/components/ui/EstadoBadge'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const mesesCorto = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default async function ParceleroDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!parcela) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-2">Bienvenido</h1>
        <p className="text-gray-500">Tu cuenta aún no está vinculada a ninguna parcela. Contacta al comité.</p>
      </div>
    )
  }

  const [{ data: cuentas }, { data: lecturas }] = await Promise.all([
    supabase
      .from('cuentas_parcela')
      .select('*, periodo:periodos_facturacion(mes,anio,fecha_vencimiento,fecha_corte,costo_unitario_kwh,cargo_fijo)')
      .eq('parcela_id', parcela.id),
    supabase
      .from('lecturas')
      .select('*, periodo:periodos_facturacion(mes,anio)')
      .eq('parcela_id', parcela.id)
      .eq('confirmado', true),
  ])

  type Cuenta = NonNullable<typeof cuentas>[number] & {
    periodo: { mes: number; anio: number; fecha_vencimiento: string; fecha_corte: string | null; costo_unitario_kwh: number; cargo_fijo: number }
  }
  type Lectura = NonNullable<typeof lecturas>[number] & { periodo: { mes: number; anio: number } }

  const claveP = (p: { anio: number; mes: number }) => p.anio * 100 + p.mes
  const cuentasOrd = ((cuentas ?? []) as Cuenta[]).sort((a, b) => claveP(b.periodo) - claveP(a.periodo))
  const lecturasOrd = ((lecturas ?? []) as Lectura[]).sort((a, b) => claveP(b.periodo) - claveP(a.periodo))

  // Pagos de todas mis cuentas
  const { data: pagos } = await supabase
    .from('pagos')
    .select('*, cuenta:cuentas_parcela(periodo:periodos_facturacion(mes,anio))')
    .in('cuenta_id', cuentasOrd.map(c => c.id))
    .order('fecha', { ascending: false })

  const cuentaActual = cuentasOrd[0]
  const hoy = new Date()
  const diasVencimiento = cuentaActual?.periodo?.fecha_vencimiento
    ? Math.ceil((new Date(cuentaActual.periodo.fecha_vencimiento).getTime() - hoy.getTime()) / 86400000)
    : null

  const deudaTotal = cuentasOrd.reduce((s, c) => s + Math.max(c.monto_prorrateado - c.monto_pagado, 0), 0)
  const consumoAcumulado = lecturasOrd.reduce((s, l) => s + (l.estado === 'normal' && l.consumo_kwh > 0 ? Number(l.consumo_kwh) : 0), 0)

  // Datos para gráfico: últimos 12 períodos, orden cronológico
  const grafico = [...lecturasOrd].reverse().slice(-12).map(l => ({
    etiqueta: `${mesesCorto[l.periodo.mes - 1]} ${String(l.periodo.anio).slice(2)}`,
    kwh: l.estado === 'normal' ? Math.max(Number(l.consumo_kwh), 0) : 0,
  }))
  const maxKwh = Math.max(...grafico.map(g => g.kwh), 1)

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Mi cuenta — Parcela #{parcela.numero}</h1>
      <p className="text-gray-500 mb-6">{parcela.nombre_dueno}</p>

      {/* Resumen superior */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl border p-4 ${deudaTotal > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <p className="text-xs text-gray-500">Deuda total</p>
          <p className={`text-2xl font-bold ${deudaTotal > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {deudaTotal > 0 ? $(deudaTotal) : 'Al día ✓'}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Consumo acumulado</p>
          <p className="text-2xl font-bold text-blue-700">{consumoAcumulado} kWh</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Último consumo</p>
          <p className="text-2xl font-bold">{lecturasOrd[0] ? `${lecturasOrd[0].consumo_kwh} kWh` : '—'}</p>
        </div>
      </div>

      {/* Cuenta del período actual */}
      {cuentaActual && (
        <div className={`rounded-xl border p-5 mb-6 ${cuentaActual.estado === 'mora' ? 'border-red-300 bg-red-50' : cuentaActual.estado === 'pagado' ? 'border-green-300 bg-green-50' : 'bg-white'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">
                Período actual: {meses[cuentaActual.periodo.mes - 1]} {cuentaActual.periodo.anio}
              </p>
              <p className="text-3xl font-bold">{$(cuentaActual.monto_prorrateado)}</p>
              <div className="text-sm text-gray-500 mt-2 space-y-0.5">
                <p>Consumo: {$(cuentaActual.monto_consumo ?? 0)} · Cargo fijo: {$(cuentaActual.monto_cargo_fijo ?? 0)}</p>
                {cuentaActual.monto_pagado > 0 && (
                  <p>Pagado: {$(cuentaActual.monto_pagado)} · Saldo: <strong className="text-red-600">{$(Math.max(cuentaActual.monto_prorrateado - cuentaActual.monto_pagado, 0))}</strong></p>
                )}
              </div>
            </div>
            <EstadoBadge estado={cuentaActual.estado} />
          </div>
          <div className="mt-3 flex gap-6 text-sm">
            {cuentaActual.periodo.fecha_vencimiento && (
              <div>
                <span className="text-gray-500">Vencimiento: </span>
                <span className={`font-medium ${diasVencimiento != null && diasVencimiento <= 3 ? 'text-red-600' : ''}`}>
                  {new Date(cuentaActual.periodo.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL')}
                  {diasVencimiento != null && diasVencimiento >= 0 && diasVencimiento <= 15 && (
                    <span className="ml-1 text-orange-600">(quedan {diasVencimiento} días)</span>
                  )}
                </span>
              </div>
            )}
            {cuentaActual.periodo.fecha_corte && cuentaActual.estado !== 'pagado' && (
              <div>
                <span className="text-gray-500">Posible corte: </span>
                <span className="font-medium text-red-600">
                  {new Date(cuentaActual.periodo.fecha_corte + 'T00:00:00').toLocaleDateString('es-CL')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gráfico de consumos */}
      {grafico.length > 0 && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <h2 className="text-lg font-semibold mb-4">📈 Evolución de mi consumo (kWh)</h2>
          <div className="flex items-end gap-2 h-40">
            {grafico.map((g, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-xs font-medium text-blue-700 mb-1">{g.kwh}</span>
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                  style={{ height: `${Math.max((g.kwh / maxKwh) * 100, 2)}%` }}
                />
                <span className="text-[10px] text-gray-500 mt-1 whitespace-nowrap">{g.etiqueta}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de consumos */}
      <h2 className="text-lg font-semibold mb-3">🔢 Historial de lecturas y consumos</h2>
      <div className="bg-white rounded-xl border overflow-auto mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Lect. anterior</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Lect. actual</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Consumo</th>
            </tr>
          </thead>
          <tbody>
            {lecturasOrd.map(l => (
              <tr key={l.id} className="border-t">
                <td className="px-4 py-2">{meses[l.periodo.mes - 1]} {l.periodo.anio}</td>
                <td className="px-4 py-2 text-right">{l.lectura_anterior}</td>
                <td className="px-4 py-2 text-right">{l.lectura_actual}</td>
                <td className="px-4 py-2 text-right font-medium">
                  {l.estado === 'normal' ? `${l.consumo_kwh} kWh` : <span className="text-yellow-600 text-xs uppercase">{l.estado.replace('_', ' ')}</span>}
                </td>
              </tr>
            ))}
            {lecturasOrd.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Sin lecturas registradas aún</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Estados de cuenta */}
      <h2 className="text-lg font-semibold mb-3">📋 Mis estados de cuenta</h2>
      <div className="bg-white rounded-xl border overflow-auto mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Consumo</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Cargo fijo</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Pagado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cuentasOrd.map(c => {
              const saldo = Math.max(c.monto_prorrateado - c.monto_pagado, 0)
              return (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2">{meses[c.periodo.mes - 1]} {c.periodo.anio}</td>
                  <td className="px-4 py-2 text-right">{$(c.monto_consumo ?? 0)}</td>
                  <td className="px-4 py-2 text-right">{$(c.monto_cargo_fijo ?? 0)}</td>
                  <td className="px-4 py-2 text-right font-medium">{$(c.monto_prorrateado)}</td>
                  <td className="px-4 py-2 text-right text-green-700">{$(c.monto_pagado)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${saldo > 0 ? 'text-red-600' : 'text-gray-400'}`}>{saldo > 0 ? $(saldo) : '—'}</td>
                  <td className="px-4 py-2"><EstadoBadge estado={c.estado} /></td>
                </tr>
              )
            })}
            {cuentasOrd.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Sin cuentas registradas aún</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagos realizados */}
      <h2 className="text-lg font-semibold mb-3">💰 Pagos que he realizado</h2>
      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Monto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Método</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Observación</th>
            </tr>
          </thead>
          <tbody>
            {(pagos ?? []).map((p: { id: string; fecha: string; monto: number; metodo: string; observacion: string | null; cuenta: { periodo: { mes: number; anio: number } } }) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-CL')}</td>
                <td className="px-4 py-2">{p.cuenta?.periodo ? `${meses[p.cuenta.periodo.mes - 1]} ${p.cuenta.periodo.anio}` : '—'}</td>
                <td className="px-4 py-2 text-right font-medium text-green-700">{$(p.monto)}</td>
                <td className="px-4 py-2 capitalize">{p.metodo}</td>
                <td className="px-4 py-2 text-gray-500">{p.observacion || '—'}</td>
              </tr>
            ))}
            {(!pagos || pagos.length === 0) && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin pagos registrados aún</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
