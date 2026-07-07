import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EstadoBadge from '@/components/ui/EstadoBadge'
import Link from 'next/link'
import FeedAnuncios from '@/components/parcelero/FeedAnuncios'
import SubirLectura from '@/components/parcelero/SubirLectura'

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

  const [{ data: cuentas }, { data: lecturas }, { data: cuentaGC }] = await Promise.all([
    supabase
      .from('cuentas_parcela')
      .select('*, periodo:periodos_facturacion(mes,anio,fecha_vencimiento,fecha_corte,costo_unitario_kwh,cargo_fijo,monto_total_factura,archivo_factura_url)')
      .eq('parcela_id', parcela.id),
    supabase
      .from('lecturas')
      .select('*, periodo:periodos_facturacion(mes,anio)')
      .eq('parcela_id', parcela.id)
      .eq('confirmado', true),
    supabase
      .from('cuentas_gc')
      .select('*, periodo:periodos_gc(mes,anio,fecha_vencimiento)')
      .eq('parcela_id', parcela.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  type Cuenta = NonNullable<typeof cuentas>[number] & {
    periodo: { mes: number; anio: number; fecha_vencimiento: string; fecha_corte: string | null; costo_unitario_kwh: number; cargo_fijo: number; monto_total_factura: number; archivo_factura_url: string | null }
  }
  type Lectura = NonNullable<typeof lecturas>[number] & { periodo: { mes: number; anio: number } }

  const claveP = (p: { anio: number; mes: number }) => p.anio * 100 + p.mes
  const cuentasOrd = ((cuentas ?? []) as Cuenta[]).sort((a, b) => claveP(b.periodo) - claveP(a.periodo))
  const lecturasOrd = ((lecturas ?? []) as Lectura[]).sort((a, b) => claveP(b.periodo) - claveP(a.periodo))

  // Pagos de todas mis cuentas + moras anteriores
  const [{ data: pagos }, { data: moras }] = await Promise.all([
    supabase
      .from('pagos')
      .select('*, cuenta:cuentas_parcela(periodo:periodos_facturacion(mes,anio))')
      .in('cuenta_id', cuentasOrd.map(c => c.id))
      .order('fecha', { ascending: false }),
    supabase
      .from('moras_anteriores')
      .select('*')
      .eq('parcela_id', parcela.id),
  ])

  const cuentaActual = cuentasOrd[0]
  const hoy = new Date()
  const diasVencimiento = cuentaActual?.periodo?.fecha_vencimiento
    ? Math.ceil((new Date(cuentaActual.periodo.fecha_vencimiento).getTime() - hoy.getTime()) / 86400000)
    : null

  // Transparencia: cuánto se ha recaudado en total del período actual vs. la factura real
  let transparenciaLuz: { totalFactura: number; recaudado: number; faltante: number } | null = null
  if (cuentaActual) {
    const { data: todasCuentasPeriodo } = await supabase
      .from('cuentas_parcela')
      .select('monto_pagado')
      .eq('periodo_id', cuentaActual.periodo_id)
    const recaudado = (todasCuentasPeriodo ?? []).reduce((s, c) => s + Number(c.monto_pagado), 0)
    transparenciaLuz = {
      totalFactura: cuentaActual.periodo.monto_total_factura,
      recaudado,
      faltante: Math.max(cuentaActual.periodo.monto_total_factura - recaudado, 0),
    }
  }

  type CuentaGCTipo = { id: string; monto: number; monto_pagado: number; estado: string; periodo: { mes: number; anio: number; fecha_vencimiento: string } | null } | null

  type Mora = { id: string; descripcion: string; monto: number; monto_pagado: number; estado: string; fecha_origen: string | null }
  const morasPendientes = ((moras ?? []) as Mora[]).filter(m => m.estado !== 'pagado')
  const deudaMoras = morasPendientes.reduce((s, m) => s + (Number(m.monto) - Number(m.monto_pagado)), 0)
  const deudaCuentas = cuentasOrd.reduce((s, c) => s + Math.max(c.monto_prorrateado - c.monto_pagado, 0), 0)
  const deudaTotal = deudaCuentas + deudaMoras
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

      <FeedAnuncios />

      {/* Autolectura del período abierto */}
      <SubirLectura />

      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">⚡ Luz</h2>

      {/* Resumen superior */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl border p-4 ${deudaTotal > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <p className="text-xs text-gray-500">Deuda total</p>
          <p className={`text-2xl font-bold ${deudaTotal > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {deudaTotal > 0 ? $(deudaTotal) : 'Al día ✓'}
          </p>
          {deudaMoras > 0 && (
            <p className="text-xs text-red-500 mt-0.5">incluye {$(deudaMoras)} de moras anteriores</p>
          )}
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
          {cuentaActual.estado !== 'pagado' && (
            <Link href="/parcelero/pagos/informar" className="inline-block mt-4 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">
              💸 Informar un pago
            </Link>
          )}
        </div>
      )}

      {/* Transparencia: cuadre real con la factura de IEL */}
      {transparenciaLuz && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-blue-900 mb-3">🔍 Transparencia — {meses[cuentaActual.periodo.mes - 1]} {cuentaActual.periodo.anio}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Valor factura total</p>
              <p className="font-bold text-lg">{$(transparenciaLuz.totalFactura)}</p>
            </div>
            <div>
              <p className="text-gray-500">Recaudado por el macrolote</p>
              <p className="font-bold text-lg text-green-700">{$(transparenciaLuz.recaudado)}</p>
            </div>
            <div>
              <p className="text-gray-500">Falta por recaudar</p>
              <p className={`font-bold text-lg ${transparenciaLuz.faltante > 0 ? 'text-red-600' : 'text-green-600'}`}>{transparenciaLuz.faltante > 0 ? $(transparenciaLuz.faltante) : '✓ Cubierto'}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Costo por kWh este período: <strong>${cuentaActual.periodo.costo_unitario_kwh}</strong> · Cargo fijo: <strong>{$(cuentaActual.periodo.cargo_fijo)}</strong>
          </p>
          {cuentaActual.periodo.archivo_factura_url && (
            <a href={cuentaActual.periodo.archivo_factura_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-sm text-blue-700 hover:underline">
              📄 Ver la factura original de IEL
            </a>
          )}
        </div>
      )}

      {/* Moras anteriores */}
      {morasPendientes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">⚠️ Deudas anteriores pendientes</h2>
          <table className="w-full text-sm">
            <tbody>
              {morasPendientes.map(m => (
                <tr key={m.id} className="border-t border-red-100">
                  <td className="py-1.5">{m.descripcion}{m.fecha_origen ? ` (${new Date(m.fecha_origen + 'T00:00:00').toLocaleDateString('es-CL')})` : ''}</td>
                  <td className="py-1.5 text-right font-medium text-red-700">{$(Number(m.monto) - Number(m.monto_pagado))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-red-600 mt-2">Contacta al comité para regularizar estas deudas.</p>
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">Validación</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Comprobante</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Observación</th>
            </tr>
          </thead>
          <tbody>
            {(pagos ?? []).map((p: { id: string; fecha: string; monto: number; metodo: string; estado?: string; comprobante_url?: string | null; observacion: string | null; cuenta: { periodo: { mes: number; anio: number } } }) => (
              <tr key={p.id} className={`border-t ${p.estado === 'rechazado' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2">{new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-CL')}</td>
                <td className="px-4 py-2">{p.cuenta?.periodo ? `${meses[p.cuenta.periodo.mes - 1]} ${p.cuenta.periodo.anio}` : '—'}</td>
                <td className="px-4 py-2 text-right font-medium text-green-700">{$(p.monto)}</td>
                <td className="px-4 py-2 capitalize">{p.metodo}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.estado === 'validado' ? 'bg-green-100 text-green-700'
                    : p.estado === 'rechazado' ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {p.estado === 'validado' ? '✓ Validado' : p.estado === 'rechazado' ? '✗ Rechazado' : '⏳ Por validar'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {p.comprobante_url
                    ? <a href={p.comprobante_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">📎 Ver</a>
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-2 text-gray-500">{p.observacion || '—'}</td>
              </tr>
            ))}
            {(!pagos || pagos.length === 0) && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Sin pagos registrados aún</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* GASTOS COMUNES */}
      <h2 className="text-xl font-bold mt-10 mb-3 flex items-center gap-2">🏘️ Gastos Comunes</h2>
      {cuentaGC ? (
        <div className={`rounded-xl border p-5 ${(cuentaGC as NonNullable<CuentaGCTipo>).estado === 'mora' ? 'border-red-300 bg-red-50' : (cuentaGC as NonNullable<CuentaGCTipo>).estado === 'pagado' ? 'border-green-300 bg-green-50' : 'bg-white'}`}>
          {(() => {
            const gc = cuentaGC as NonNullable<CuentaGCTipo>
            const saldoGC = Math.max(gc.monto - gc.monto_pagado, 0)
            return (
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  {gc.periodo && <p className="text-sm text-gray-500 mb-1">{meses[gc.periodo.mes - 1]} {gc.periodo.anio}</p>}
                  <p className="text-2xl font-bold">{$(gc.monto)}</p>
                  {gc.monto_pagado > 0 && <p className="text-sm text-gray-500">Pagado: {$(gc.monto_pagado)} · Saldo: <strong className="text-red-600">{$(saldoGC)}</strong></p>}
                </div>
                <div className="text-right">
                  <EstadoBadge estado={gc.estado as 'pendiente' | 'pagado' | 'pago_parcial' | 'mora'} />
                  {gc.periodo?.fecha_vencimiento && (
                    <p className="text-xs text-gray-500 mt-1">Vence: {new Date(gc.periodo.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL')}</p>
                  )}
                </div>
              </div>
            )
          })()}
          <Link href="/parcelero/gastos-comunes" className="inline-block mt-4 text-sm text-blue-700 hover:underline font-medium">
            Ver historial completo de Gastos Comunes →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-5 text-gray-400 text-sm">Sin cuentas de Gastos Comunes generadas aún</div>
      )}
    </div>
  )
}
