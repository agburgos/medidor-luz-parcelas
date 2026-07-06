import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EstadoBadge from '@/components/ui/EstadoBadge'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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

  const { data: cuentas } = await supabase
    .from('cuentas_parcela')
    .select('*, periodo:periodos_facturacion(mes,anio,fecha_vencimiento,fecha_corte,monto_total_factura)')
    .eq('parcela_id', parcela.id)
    .order('created_at', { ascending: false })

  const { data: lecturas } = await supabase
    .from('lecturas')
    .select('*, periodo:periodos_facturacion(mes,anio)')
    .eq('parcela_id', parcela.id)
    .order('created_at', { ascending: false })

  const cuentaActual = cuentas?.[0]
  const hoy = new Date()
  const diasVencimiento = cuentaActual?.periodo?.fecha_vencimiento
    ? Math.ceil((new Date(cuentaActual.periodo.fecha_vencimiento).getTime() - hoy.getTime()) / 86400000)
    : null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Mi cuenta — Parcela #{parcela.numero}</h1>
      <p className="text-gray-500 mb-6">{parcela.nombre_dueno}</p>

      {cuentaActual && (
        <div className={`rounded-xl border p-5 mb-6 ${cuentaActual.estado === 'mora' ? 'border-red-300 bg-red-50' : cuentaActual.estado === 'pagado' ? 'border-green-300 bg-green-50' : 'bg-white'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">
                Período actual: {meses[(cuentaActual.periodo as { mes: number }).mes - 1]} {(cuentaActual.periodo as { anio: number }).anio}
              </p>
              <p className="text-3xl font-bold">${cuentaActual.monto_prorrateado.toLocaleString('es-CL')}</p>
              {cuentaActual.monto_pagado > 0 && (
                <p className="text-sm text-gray-500 mt-1">Pagado: ${cuentaActual.monto_pagado.toLocaleString('es-CL')}</p>
              )}
            </div>
            <EstadoBadge estado={cuentaActual.estado} />
          </div>
          <div className="mt-3 flex gap-6 text-sm">
            {(cuentaActual.periodo as { fecha_vencimiento: string })?.fecha_vencimiento && (
              <div>
                <span className="text-gray-500">Vencimiento: </span>
                <span className={`font-medium ${diasVencimiento != null && diasVencimiento <= 3 ? 'text-red-600' : ''}`}>
                  {new Date((cuentaActual.periodo as { fecha_vencimiento: string }).fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL')}
                  {diasVencimiento != null && diasVencimiento >= 0 && diasVencimiento <= 7 && (
                    <span className="ml-1 text-orange-600">({diasVencimiento} días)</span>
                  )}
                </span>
              </div>
            )}
            {(cuentaActual.periodo as { fecha_corte?: string })?.fecha_corte && (
              <div>
                <span className="text-gray-500">Posible corte: </span>
                <span className="font-medium text-red-600">
                  {new Date((cuentaActual.periodo as { fecha_corte: string }).fecha_corte + 'T00:00:00').toLocaleDateString('es-CL')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Historial de consumos</h2>
      <div className="bg-white rounded-xl border overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Lect. anterior</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Lect. actual</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Consumo kWh</th>
            </tr>
          </thead>
          <tbody>
            {lecturas?.map(l => (
              <tr key={l.id} className="border-t">
                <td className="px-4 py-2">{meses[(l.periodo as { mes: number }).mes - 1]} {(l.periodo as { anio: number }).anio}</td>
                <td className="px-4 py-2 text-right">{l.lectura_anterior}</td>
                <td className="px-4 py-2 text-right">{l.lectura_actual}</td>
                <td className="px-4 py-2 text-right font-medium">{l.consumo_kwh} kWh</td>
              </tr>
            ))}
            {(!lecturas || lecturas.length === 0) && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Sin lecturas registradas aún</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mb-3">Historial de pagos</h2>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Monto</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Pagado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha pago</th>
            </tr>
          </thead>
          <tbody>
            {cuentas?.map(c => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2">{meses[(c.periodo as { mes: number }).mes - 1]} {(c.periodo as { anio: number }).anio}</td>
                <td className="px-4 py-2 text-right">${c.monto_prorrateado.toLocaleString('es-CL')}</td>
                <td className="px-4 py-2 text-right">${c.monto_pagado.toLocaleString('es-CL')}</td>
                <td className="px-4 py-2"><EstadoBadge estado={c.estado} /></td>
                <td className="px-4 py-2 text-gray-500">{c.fecha_pago ? new Date(c.fecha_pago + 'T00:00:00').toLocaleDateString('es-CL') : '—'}</td>
              </tr>
            ))}
            {(!cuentas || cuentas.length === 0) && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin cuentas registradas aún</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
