import { createClient } from '@/lib/supabase/server'
import EstadoBadge from '@/components/ui/EstadoBadge'
import { EstadoCuenta } from '@/types'

export const metadata = { title: 'Reportes — COPOSA' }


const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default async function ReportesPage() {
  const supabase = await createClient()

  const [{ data: cuentas }, { data: moras }] = await Promise.all([
    supabase
      .from('cuentas_parcela')
      .select('*, parcela:parcelas(numero,nombre_dueno,email,telefono), periodo:periodos_facturacion(mes,anio,fecha_vencimiento)'),
    supabase
      .from('moras_anteriores')
      .select('*, parcela:parcelas(numero,nombre_dueno,telefono)')
      .neq('estado', 'pagado'),
  ])

  type Cuenta = NonNullable<typeof cuentas>[number] & {
    parcela: { numero: number; nombre_dueno: string; email: string | null; telefono: string | null }
    periodo: { mes: number; anio: number; fecha_vencimiento: string }
  }

  const todas = (cuentas ?? []) as Cuenta[]
  const hoy = new Date()

  // Deudores: cuentas no pagadas (pendiente, parcial o mora)
  const deudoras = todas.filter(c => c.estado !== 'pagado')
  const vencidas = deudoras.filter(c =>
    c.periodo?.fecha_vencimiento && new Date(c.periodo.fecha_vencimiento) < hoy
  )

  // Deuda acumulada por parcela (cuentas del período + moras anteriores)
  const deudaPorParcela = new Map<number, { nombre: string; telefono: string | null; periodos: string[]; deuda: number }>()
  for (const c of deudoras) {
    const saldo = c.monto_prorrateado - c.monto_pagado
    if (saldo <= 0) continue
    const key = c.parcela.numero
    const item = deudaPorParcela.get(key) ?? { nombre: c.parcela.nombre_dueno, telefono: c.parcela.telefono, periodos: [] as string[], deuda: 0 }
    item.deuda += saldo
    item.periodos.push(`${meses[c.periodo.mes - 1]} ${String(c.periodo.anio).slice(2)}`)
    deudaPorParcela.set(key, item)
  }
  for (const m of ((moras ?? []) as { monto: number; monto_pagado: number; parcela: { numero: number; nombre_dueno: string; telefono: string | null } }[])) {
    const saldo = m.monto - m.monto_pagado
    if (saldo <= 0) continue
    const key = m.parcela.numero
    const item = deudaPorParcela.get(key) ?? { nombre: m.parcela.nombre_dueno, telefono: m.parcela.telefono, periodos: [] as string[], deuda: 0 }
    item.deuda += saldo
    if (!item.periodos.includes('Mora anterior')) item.periodos.push('Mora anterior')
    deudaPorParcela.set(key, item)
  }
  const deudores = [...deudaPorParcela.entries()].sort((a, b) => b[1].deuda - a[1].deuda)

  // Recaudación por período
  const porPeriodo = new Map<string, { facturado: number; recaudado: number; pendientes: number }>()
  for (const c of todas) {
    const key = `${meses[c.periodo.mes - 1]} ${c.periodo.anio}`
    const item = porPeriodo.get(key) ?? { facturado: 0, recaudado: 0, pendientes: 0 }
    item.facturado += c.monto_prorrateado
    item.recaudado += c.monto_pagado + (c.estado === 'pagado' ? Math.max(c.monto_prorrateado - c.monto_pagado, 0) : 0)
    if (c.estado !== 'pagado') item.pendientes++
    porPeriodo.set(key, item)
  }

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const deudaTotal = deudores.reduce((s, [, d]) => s + d.deuda, 0)

  type Mora = { id: string; descripcion: string; monto: number; monto_pagado: number; estado: string; fecha_origen: string | null; tipo: string
    parcela: { numero: number; nombre_dueno: string; telefono: string | null } }
  const morasList = ((moras ?? []) as Mora[]).sort((a, b) => (b.monto - b.monto_pagado) - (a.monto - a.monto_pagado))
  const deudaMorasTotal = morasList.reduce((s, m) => s + (m.monto - m.monto_pagado), 0)
  const deudaMorasLuz = morasList.filter(m => m.tipo === 'luz').reduce((s, m) => s + (m.monto - m.monto_pagado), 0)
  const deudaMorasGC = morasList.filter(m => m.tipo === 'gc').reduce((s, m) => s + (m.monto - m.monto_pagado), 0)
  const TIPOS_MORA: Record<string, string> = { luz: '⚡ Luz', gc: '🏘️ GC', otro: '📄 Otro' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reportes de cobranza</h1>
        <a
          href="/api/reportes/moras"
          className="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-700"
        >
          ⬇️ Descargar reporte de moras (CSV)
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Deuda total por cobrar</p>
          <p className="text-xl font-bold text-red-600">{$(deudaTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Parcelas con deuda</p>
          <p className="text-xl font-bold text-orange-600">{deudores.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Cuentas vencidas</p>
          <p className="text-xl font-bold text-red-600">{vencidas.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Cuentas al día</p>
          <p className="text-xl font-bold text-green-600">{todas.filter(c => c.estado === 'pagado').length}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">🔴 Deudores (ordenados por deuda)</h2>
      <div className="bg-white rounded-xl border overflow-auto mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Parcela</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Propietario</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Teléfono</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Períodos adeudados</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Deuda total</th>
            </tr>
          </thead>
          <tbody>
            {deudores.map(([numero, d]) => (
              <tr key={numero} className="border-t">
                <td className="px-4 py-2 font-medium">#{numero}</td>
                <td className="px-4 py-2">{d.nombre}</td>
                <td className="px-4 py-2 text-gray-500">{d.telefono || '—'}</td>
                <td className="px-4 py-2 text-gray-600">{d.periodos.join(', ')} <span className="text-xs text-gray-400">({d.periodos.length})</span></td>
                <td className="px-4 py-2 text-right font-bold text-red-600">{$(d.deuda)}</td>
              </tr>
            ))}
            {deudores.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">🎉 Sin deudores</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mb-3">📜 Moras anteriores (deuda histórica, previa al sistema)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">⚡ Moras de Luz</p>
          <p className="text-lg font-bold text-red-600">{$(deudaMorasLuz)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">🏘️ Moras de Gastos Comunes</p>
          <p className="text-lg font-bold text-red-600">{$(deudaMorasGC)}</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border overflow-auto mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Parcela</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Teléfono</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {morasList.map(m => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-2 font-medium">#{m.parcela.numero} {m.parcela.nombre_dueno}</td>
                <td className="px-4 py-2">{TIPOS_MORA[m.tipo] ?? m.tipo}</td>
                <td className="px-4 py-2 text-gray-600">{m.descripcion}</td>
                <td className="px-4 py-2 text-gray-500">{m.parcela.telefono || '—'}</td>
                <td className="px-4 py-2 text-right font-bold text-red-600">{$(m.monto - m.monto_pagado)}</td>
              </tr>
            ))}
            {morasList.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin moras anteriores pendientes</td></tr>
            )}
          </tbody>
          {morasList.length > 0 && (
            <tfoot>
              <tr className="border-t bg-gray-50 font-bold">
                <td colSpan={4} className="px-4 py-2 text-right">Total moras anteriores</td>
                <td className="px-4 py-2 text-right text-red-600">{$(deudaMorasTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-gray-400 -mt-6 mb-8">
        Para cargar o abonar una mora, ve a Parcelas → botón &quot;Moras&quot; de la fila correspondiente.
      </p>

      <h2 className="text-lg font-semibold mb-3">📊 Recaudación por período</h2>
      <div className="bg-white rounded-xl border overflow-auto mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Facturado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Recaudado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">% cobrado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Cuentas pendientes</th>
            </tr>
          </thead>
          <tbody>
            {[...porPeriodo.entries()].map(([nombre, p]) => (
              <tr key={nombre} className="border-t">
                <td className="px-4 py-2 font-medium">{nombre}</td>
                <td className="px-4 py-2 text-right">{$(p.facturado)}</td>
                <td className="px-4 py-2 text-right text-green-700">{$(p.recaudado)}</td>
                <td className="px-4 py-2 text-right">{p.facturado > 0 ? Math.round(p.recaudado / p.facturado * 100) : 0}%</td>
                <td className="px-4 py-2 text-right">{p.pendientes}</td>
              </tr>
            ))}
            {porPeriodo.size === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin períodos con cuentas generadas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mb-3">⏰ Cuentas vencidas (detalle)</h2>
      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Parcela</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Venció</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Días de atraso</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody>
            {vencidas
              .sort((a, b) => new Date(a.periodo.fecha_vencimiento).getTime() - new Date(b.periodo.fecha_vencimiento).getTime())
              .map(c => {
                const dias = Math.floor((hoy.getTime() - new Date(c.periodo.fecha_vencimiento).getTime()) / 86400000)
                return (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-2 font-medium">#{c.parcela.numero} {c.parcela.nombre_dueno}</td>
                    <td className="px-4 py-2">{meses[c.periodo.mes - 1]} {c.periodo.anio}</td>
                    <td className="px-4 py-2">{new Date(c.periodo.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL')}</td>
                    <td className="px-4 py-2 text-right font-medium text-red-600">{dias}</td>
                    <td className="px-4 py-2 text-right">{$(c.monto_prorrateado - c.monto_pagado)}</td>
                    <td className="px-4 py-2"><EstadoBadge estado={c.estado as EstadoCuenta} /></td>
                  </tr>
                )
              })}
            {vencidas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin cuentas vencidas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
