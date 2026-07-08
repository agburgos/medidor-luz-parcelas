import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const mesesCorto = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default async function ComiteDashboard() {
  const supabase = await createClient()

  const [
    { count: totalParcelas },
    { data: periodos },
    { data: periodosGC },
    { data: cuentasLuz },
    { data: cuentasGC },
    { data: moras },
    { data: anuncios },
    { data: movimientosCaja },
  ] = await Promise.all([
    supabase.from('parcelas').select('*', { count: 'exact', head: true }),
    supabase
      .from('periodos_facturacion')
      .select('*')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(5),
    supabase
      .from('periodos_gc')
      .select('*')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(5),
    supabase.from('cuentas_parcela').select('monto_prorrateado, monto_pagado, periodo:periodos_facturacion(mes,anio)'),
    supabase.from('cuentas_gc').select('monto, monto_pagado, periodo:periodos_gc(mes,anio)'),
    supabase.from('moras_anteriores').select('monto, monto_pagado, tipo').neq('estado', 'pagado'),
    supabase.from('anuncios').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('caja_movimientos').select('tipo, monto'),
  ])

  const periodoActivo = periodos?.find(p => p.estado === 'abierto')

  type CLuz = { monto_prorrateado: number; monto_pagado: number; periodo: { mes: number; anio: number } | null }
  type CGC = { monto: number; monto_pagado: number; periodo: { mes: number; anio: number } | null }
  type Mora = { monto: number; monto_pagado: number; tipo: string }

  const luz = (cuentasLuz ?? []) as unknown as CLuz[]
  const gc = (cuentasGC ?? []) as unknown as CGC[]
  const morasList = (moras ?? []) as Mora[]

  const recaudadoLuz = luz.reduce((s, c) => s + Number(c.monto_pagado), 0)
  const recaudadoGC = gc.reduce((s, c) => s + Number(c.monto_pagado), 0)
  const deudaLuzCuentas = luz.reduce((s, c) => s + Math.max(c.monto_prorrateado - c.monto_pagado, 0), 0)
  const deudaGCCuentas = gc.reduce((s, c) => s + Math.max(c.monto - c.monto_pagado, 0), 0)
  const deudaMorasLuz = morasList.filter(m => m.tipo === 'luz').reduce((s, m) => s + (m.monto - m.monto_pagado), 0)
  const deudaMorasGC = morasList.filter(m => m.tipo === 'gc').reduce((s, m) => s + (m.monto - m.monto_pagado), 0)
  const deudaMorasOtro = morasList.filter(m => m.tipo === 'otro').reduce((s, m) => s + (m.monto - m.monto_pagado), 0)

  const totalRecaudado = recaudadoLuz + recaudadoGC
  const totalDeudaLuz = deudaLuzCuentas + deudaMorasLuz
  const totalDeudaGC = deudaGCCuentas + deudaMorasGC
  const totalDeuda = totalDeudaLuz + totalDeudaGC + deudaMorasOtro

  // Cálculos de Caja
  type MovCaja = { tipo: string; monto: number }
  const movsCaja = (movimientosCaja ?? []) as MovCaja[]
  const totalIngresos = movsCaja.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
  const totalEgresos = movsCaja.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)
  const saldoCaja = 169158 + totalIngresos - totalEgresos

  // Reporte por mes: combina luz y GC
  const porMes = new Map<string, { facturadoLuz: number; recaudadoLuz: number; facturadoGC: number; recaudadoGC: number }>()
  for (const c of luz) {
    if (!c.periodo) continue
    const key = `${c.periodo.anio}-${String(c.periodo.mes).padStart(2, '0')}`
    const item = porMes.get(key) ?? { facturadoLuz: 0, recaudadoLuz: 0, facturadoGC: 0, recaudadoGC: 0 }
    item.facturadoLuz += c.monto_prorrateado
    item.recaudadoLuz += c.monto_pagado
    porMes.set(key, item)
  }
  for (const c of gc) {
    if (!c.periodo) continue
    const key = `${c.periodo.anio}-${String(c.periodo.mes).padStart(2, '0')}`
    const item = porMes.get(key) ?? { facturadoLuz: 0, recaudadoLuz: 0, facturadoGC: 0, recaudadoGC: 0 }
    item.facturadoGC += c.monto
    item.recaudadoGC += c.monto_pagado
    porMes.set(key, item)
  }
  const filasMes = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Comité</h1>

      {/* Totales grandes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <p className="text-sm text-green-700">💰 Total recaudado</p>
          <p className="text-2xl font-bold text-green-700">{$(totalRecaudado)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="text-sm text-blue-700">🏦 Caja</p>
          <p className="text-2xl font-bold text-blue-700">{$(saldoCaja)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <p className="text-sm text-emerald-700">📥 Ingresos</p>
          <p className="text-2xl font-bold text-emerald-700">{$(totalIngresos)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-sm text-red-700">🔴 Deuda total</p>
          <p className="text-2xl font-bold text-red-700">{$(totalDeuda)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Total parcelas</p>
          <p className="text-3xl font-bold text-blue-700">{totalParcelas ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Período de luz activo</p>
          <p className="text-xl font-semibold">
            {periodoActivo
              ? `${meses[periodoActivo.mes - 1]} ${periodoActivo.anio}`
              : 'Sin período activo'}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Vencimiento</p>
          <p className="text-xl font-semibold text-orange-600">
            {periodoActivo?.fecha_vencimiento
              ? new Date(periodoActivo.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL')
              : '—'}
          </p>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap mb-8">
        <Link href="/comite/periodos/nuevo" className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors">
          + Nuevo período de luz
        </Link>
        {periodoActivo && (
          <Link href={`/comite/periodos/${periodoActivo.id}`} className="border border-blue-600 text-blue-600 rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-50 transition-colors">
            Ver período activo
          </Link>
        )}
      </div>

      {/* Reporte por meses */}
      <h2 className="text-lg font-semibold mb-3">📊 Reporte de recaudación por mes</h2>
      <div className="bg-white rounded-xl border overflow-auto mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mes</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Facturado Luz</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Recaudado Luz</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Facturado GC</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Recaudado GC</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total recaudado</th>
            </tr>
          </thead>
          <tbody>
            {filasMes.map(([key, m]) => {
              const [anio, mes] = key.split('-').map(Number)
              return (
                <tr key={key} className="border-t">
                  <td className="px-4 py-2 font-medium">{mesesCorto[mes - 1]} {anio}</td>
                  <td className="px-4 py-2 text-right">{$(m.facturadoLuz)}</td>
                  <td className="px-4 py-2 text-right text-green-700">{$(m.recaudadoLuz)}</td>
                  <td className="px-4 py-2 text-right">{$(m.facturadoGC)}</td>
                  <td className="px-4 py-2 text-right text-green-700">{$(m.recaudadoGC)}</td>
                  <td className="px-4 py-2 text-right font-bold">{$(m.recaudadoLuz + m.recaudadoGC)}</td>
                </tr>
              )
            })}
            {filasMes.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin datos aún</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Anuncios recientes con reacciones */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">📢 Anuncios recientes</h2>
        <Link href="/comite/anuncios" className="text-sm text-blue-600 hover:underline">Ver todos / Publicar →</Link>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Título</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Publicado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">👍 Likes</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">👎 Dislikes</th>
            </tr>
          </thead>
          <tbody>
            {(anuncios ?? []).map(a => (
              <AnuncioFila key={a.id} id={a.id} titulo={a.titulo} fecha={a.created_at} />
            ))}
            {(!anuncios || anuncios.length === 0) && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Sin anuncios publicados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">⚡ Últimos períodos de Luz</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Factura</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Vence</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {periodos?.map(p => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{meses[p.mes - 1]} {p.anio}</td>
                    <td className="px-4 py-3">${p.monto_total_factura?.toLocaleString('es-CL')}</td>
                    <td className="px-4 py-3">{p.fecha_vencimiento ? new Date(p.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.estado === 'abierto' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/comite/periodos/${p.id}`} className="text-blue-600 hover:underline">Ver</Link>
                    </td>
                  </tr>
                ))}
                {(!periodos || periodos.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin períodos registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">🏘️ Últimos períodos de Gastos Comunes</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Vence</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {periodosGC?.map(p => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{meses[p.mes - 1]} {p.anio}</td>
                    <td className="px-4 py-3">${p.valor_mensual?.toLocaleString('es-CL')}</td>
                    <td className="px-4 py-3">{p.fecha_vencimiento ? new Date(p.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.estado === 'abierto' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/comite/gastos-comunes/${p.id}`} className="text-blue-600 hover:underline">Ver</Link>
                    </td>
                  </tr>
                ))}
                {(!periodosGC || periodosGC.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin períodos de GC registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

async function AnuncioFila({ id, titulo, fecha }: { id: string; titulo: string; fecha: string }) {
  const supabase = await createClient()
  const { data: reacciones } = await supabase.from('anuncio_reacciones').select('tipo').eq('anuncio_id', id)
  const likes = (reacciones ?? []).filter(r => r.tipo === 'like').length
  const dislikes = (reacciones ?? []).filter(r => r.tipo === 'dislike').length
  return (
    <tr className="border-t">
      <td className="px-4 py-2 font-medium">{titulo}</td>
      <td className="px-4 py-2 text-gray-500">{new Date(fecha).toLocaleDateString('es-CL')}</td>
      <td className="px-4 py-2 text-right text-green-700">{likes}</td>
      <td className="px-4 py-2 text-right text-red-600">{dislikes}</td>
    </tr>
  )
}
