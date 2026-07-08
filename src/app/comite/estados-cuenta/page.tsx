'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ResumenParcela {
  id: string
  numero: number
  nombre_dueno: string
  email: string | null
  deuda_luz: number
  deuda_gc: number
  deuda_moras: number
  deuda_total: number
}

export default function EstadosCuentaPage() {
  const [parcelas, setParcelas] = useState<ResumenParcela[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [soloDeudores, setSoloDeudores] = useState(false)
  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 15

  const cargar = useCallback(async () => {
    const res = await fetch('/api/parcelas/estados-cuenta')
    const data = await res.json()
    setParcelas(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  const q = busqueda.trim().toLowerCase()
  const filtradas = parcelas
    .filter(p => !soloDeudores || p.deuda_total > 0)
    .filter(p => !q || String(p.numero).includes(q) || p.nombre_dueno.toLowerCase().includes(q))

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  const deudaTotalGeneral = parcelas.reduce((s, p) => s + p.deuda_total, 0)
  const parcelasEnDeuda = parcelas.filter(p => p.deuda_total > 0).length

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">📊 Estados de Cuenta</h1>
          <p className="text-gray-500 text-sm">Deuda consolidada por parcela (Luz + Gastos Comunes + moras anteriores)</p>
        </div>
        <Link href="/comite/caja" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">
          🏦 Ir a Caja
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Total parcelas</p>
          <p className="text-xl font-bold">{parcelas.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Parcelas con deuda</p>
          <p className="text-xl font-bold text-red-600">{parcelasEnDeuda}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Deuda total consolidada</p>
          <p className="text-xl font-bold text-red-600">{$(deudaTotalGeneral)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
          placeholder="🔍 Buscar #parcela o dueño..."
          className="border rounded-lg px-3 py-2 text-sm w-64"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={soloDeudores} onChange={e => { setSoloDeudores(e.target.checked); setPagina(1) }} />
          Solo con deuda
        </label>
      </div>

      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Parcela</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Dueño</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Deuda Luz</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Deuda GC</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Deuda Moras</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Acción</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(p => (
              <tr key={p.id} className={`border-t ${p.deuda_total > 0 ? '' : 'bg-green-50/40'}`}>
                <td className="px-4 py-2 font-medium">#{p.numero}</td>
                <td className="px-4 py-2">{p.nombre_dueno}</td>
                <td className="px-4 py-2 text-right">{p.deuda_luz > 0 ? $(p.deuda_luz) : '—'}</td>
                <td className="px-4 py-2 text-right">{p.deuda_gc > 0 ? $(p.deuda_gc) : '—'}</td>
                <td className="px-4 py-2 text-right">{p.deuda_moras > 0 ? $(p.deuda_moras) : '—'}</td>
                <td className={`px-4 py-2 text-right font-bold ${p.deuda_total > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {p.deuda_total > 0 ? $(p.deuda_total) : 'Al día ✓'}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/comite/estados-cuenta/${p.id}`} className="text-xs bg-blue-100 text-blue-700 rounded px-3 py-1.5 hover:bg-blue-200">
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filtradas.length > POR_PAGINA && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">
            Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, filtradas.length)} de {filtradas.length}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={paginaActual === 1} className="border rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
            <span className="text-gray-600">{paginaActual} / {totalPaginas}</span>
            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas} className="border rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50">Siguiente →</button>
          </div>
        </div>
      )}
    </div>
  )
}
