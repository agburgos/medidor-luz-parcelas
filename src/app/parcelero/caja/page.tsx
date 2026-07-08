'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

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

export default function CajaPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'egreso'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [saldoInicial, setSaldoInicial] = useState<number | null>(null)
  const POR_PAGINA = 15

  const cargar = useCallback(async () => {
    const res = await fetch('/api/transparencia/caja')
    const data = await res.json()
    setMovimientos(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    fetch('/api/caja/saldo-inicial').then(r => r.json()).then(d => setSaldoInicial(d.saldo_inicial ?? 0)).catch(() => setSaldoInicial(0))
  }, [])

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
  const totalEgresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)
  const saldoActual = (saldoInicial ?? 0) + totalIngresos - totalEgresos

  const q = busqueda.trim().toLowerCase()
  const filtrados = movimientos.filter(m =>
    (filtroTipo === 'todos' || m.tipo === filtroTipo) &&
    (!q || m.concepto.toLowerCase().includes(q) || (m.observacion ?? '').toLowerCase().includes(q))
  )
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">💰 Caja y Tesorería</h1>
          <p className="text-gray-500 text-sm">Registro de ingresos y egresos de la comunidad (solo lectura)</p>
        </div>
        <Link
          href="/parcelero/caja/libro-contable"
          className="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-700"
        >
          📊 Libro Contable
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Saldo Inicial</p>
          <p className="text-xl font-bold text-blue-700">{saldoInicial === null ? '...' : $(saldoInicial)}</p>
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

      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-6 mb-8">
        <p className="text-sm opacity-90">Saldo Actual</p>
        <p className="text-4xl font-bold">{$(saldoActual)}</p>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Movimientos ({filtrados.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
              placeholder="🔍 Buscar concepto..."
              className="border rounded-lg px-3 py-1.5 text-sm w-48"
            />
            <select
              value={filtroTipo}
              onChange={e => { setFiltroTipo(e.target.value as 'todos' | 'ingreso' | 'egreso'); setPagina(1) }}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="ingreso">📥 Ingresos</option>
              <option value="egreso">📤 Egresos</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="text-gray-500 text-sm p-8 text-center">Cargando movimientos...</div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            {movimientos.length === 0 ? 'No hay movimientos registrados' : 'Sin resultados para el filtro'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Concepto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Monto</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Observación</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-3">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-CL')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        m.tipo === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {m.tipo === 'ingreso' ? '📥 Ingreso' : '📤 Egreso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{m.concepto}</td>
                    <td className={`px-4 py-3 text-right font-bold ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{$(Number(m.monto))}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {m.documento_url && (
                        <a href={`/api/documentos/descargar?path=${encodeURIComponent(m.documento_url)}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          📎 Descargar
                        </a>
                      )}
                      {!m.documento_url && (m.observacion ? `"${m.observacion}"` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtrados.length > POR_PAGINA && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-gray-500">
              Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtrados.length)} de {filtrados.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={paginaActual === 1}
                className="border rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50"
              >
                ← Anterior
              </button>
              <span className="text-gray-600">{paginaActual} / {totalPaginas}</span>
              <button
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaActual === totalPaginas}
                className="border rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
