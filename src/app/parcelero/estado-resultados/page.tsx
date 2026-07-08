'use client'

import { useState, useEffect } from 'react'

interface Movimiento {
  id: string
  tipo: 'ingreso' | 'egreso'
  concepto: string
  monto: number
  fecha: string
  documento_url: string | null
  observacion: string | null
  created_at: string
}

export default function EstadoResultadosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'egreso'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 15

  useEffect(() => {
    fetch('/api/caja/movimientos')
      .then(r => r.json())
      .then(d => { setMovimientos(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
  const totalEgresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)
  const saldoActual = 169158 + totalIngresos - totalEgresos

  // Filtrado + paginación
  const q = busqueda.trim().toLowerCase()
  const filtrados = movimientos.filter(m =>
    (filtroTipo === 'todos' || m.tipo === filtroTipo) &&
    (!q || m.concepto.toLowerCase().includes(q) || (m.observacion ?? '').toLowerCase().includes(q))
  )
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  if (loading) return <div className="p-8 text-gray-500">Cargando estado de resultados...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">📊 Estado de Resultados</h1>
      <p className="text-gray-500 text-sm mb-6">Situación consolidada de la comunidad (historial completo)</p>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Saldo Inicial</p>
          <p className="text-xl font-bold text-blue-700">$169.158</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Total Ingresos</p>
          <p className="text-xl font-bold text-green-600">{$(totalIngresos)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Total Egresos</p>
          <p className="text-xl font-bold text-red-600">{$(totalEgresos)}</p>
        </div>
      </div>

      {/* Saldo Actual */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-6 mb-6">
        <p className="text-sm opacity-90">Saldo Actual</p>
        <p className="text-4xl font-bold">{$(saldoActual)}</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar por concepto u observación..."
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <select
              value={filtroTipo}
              onChange={e => { setFiltroTipo(e.target.value as any); setPagina(1) }}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="todos">Todos</option>
              <option value="ingreso">📈 Ingresos</option>
              <option value="egreso">📉 Egresos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Concepto</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Monto</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Observación</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Sin movimientos registrados
                </td>
              </tr>
            ) : (
              visibles.map(m => (
                <tr key={m.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(m.fecha).toLocaleDateString('es-CL')}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700">{m.concepto}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      m.tipo === 'ingreso'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {m.tipo === 'ingreso' ? '📈 Ingreso' : '📉 Egreso'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${
                    m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {m.tipo === 'ingreso' ? '+' : '-'}{$(m.monto)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{m.observacion || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500">
            Página {paginaActual} de {totalPaginas} ({filtrados.length} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagina(Math.max(1, paginaActual - 1))}
              disabled={paginaActual === 1}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPagina(Math.min(totalPaginas, paginaActual + 1))}
              disabled={paginaActual === totalPaginas}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>ℹ️ Transparencia:</strong> Este estado muestra todos los movimientos de caja de la comunidad.
          Puedes filtrar por tipo (ingreso/egreso) y buscar por concepto para auditar la gestión financiera.
        </p>
      </div>
    </div>
  )
}
