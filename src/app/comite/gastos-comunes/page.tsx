'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface PeriodoGC {
  id: string; mes: number; anio: number; valor_mensual: number
  fecha_vencimiento: string; fecha_corte: string | null; estado: string
}

export default function GastosComunesPage() {
  const [config, setConfig] = useState<{ comunidad_id: string; valor_mensual: number } | null>(null)
  const [periodos, setPeriodos] = useState<PeriodoGC[]>([])
  const [valorForm, setValorForm] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardandoConfig, setGuardandoConfig] = useState(false)

  const hoy = new Date()
  const [nuevo, setNuevo] = useState({
    mes: hoy.getMonth() + 1, anio: hoy.getFullYear(),
    valor_mensual: '', fecha_vencimiento: '', fecha_corte: '',
  })
  const [creando, setCreando] = useState(false)
  const [archivoFile, setArchivoFile] = useState<File | null>(null)

  const cargar = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([fetch('/api/config-gc'), fetch('/api/gc/periodos')])
    const c = await cRes.json()
    const p = await pRes.json()
    if (!c.error) { setConfig(c); setValorForm(String(c.valor_mensual)); setNuevo(n => ({ ...n, valor_mensual: String(c.valor_mensual) })) }
    setPeriodos(Array.isArray(p) ? p : [])
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardarConfig(e: React.FormEvent) {
    e.preventDefault()
    setGuardandoConfig(true)
    const res = await fetch('/api/config-gc', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comunidad_id: config?.comunidad_id, valor_mensual: valorForm }),
    })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Valor de gasto común actualizado' : `❌ ${data.error}`)
    setGuardandoConfig(false)
    await cargar()
  }

  async function crearPeriodo(e: React.FormEvent) {
    e.preventDefault()
    setCreando(true)
    setMensaje('')
    const fd = new FormData()
    Object.entries(nuevo).forEach(([k, v]) => fd.append(k, String(v)))
    if (archivoFile) fd.append('archivo', archivoFile)
    const res = await fetch('/api/gc/periodos', { method: 'POST', body: fd })
    const data = await res.json()
    setMensaje(res.ok ? `✅ Período creado, ${data.cuentas_generadas} cuentas generadas` : `❌ ${data.error}`)
    setCreando(false)
    setArchivoFile(null)
    await cargar()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Gastos Comunes</h1>
      <p className="text-gray-500 text-sm mb-6">Valor único mensual, igual para todas las parcelas activas</p>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <form onSubmit={guardarConfig} className="bg-white rounded-xl border p-5">
          <h2 className="font-medium mb-3">Valor mensual configurado</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">$</span>
            <input
              type="number"
              value={valorForm}
              onChange={e => setValorForm(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-32"
            />
            <button type="submit" disabled={guardandoConfig} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {guardandoConfig ? '...' : 'Guardar'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Este valor se usa como sugerencia al crear un nuevo período.</p>
        </form>

        <form onSubmit={crearPeriodo} className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="font-medium mb-1">+ Nuevo período de GC</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={nuevo.mes} onChange={e => setNuevo(n => ({ ...n, mes: Number(e.target.value) }))} className="border rounded-lg px-3 py-2 text-sm">
              {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" value={nuevo.anio} onChange={e => setNuevo(n => ({ ...n, anio: Number(e.target.value) }))} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <input
            type="number" placeholder="Valor ($)"
            value={nuevo.valor_mensual}
            onChange={e => setNuevo(n => ({ ...n, valor_mensual: e.target.value }))}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="date" value={nuevo.fecha_vencimiento} onChange={e => setNuevo(n => ({ ...n, fecha_vencimiento: e.target.value }))} required className="border rounded-lg px-3 py-2 text-sm" title="Vencimiento" />
            <input type="date" value={nuevo.fecha_corte} onChange={e => setNuevo(n => ({ ...n, fecha_corte: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" title="Corte (opcional)" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Documento respaldo (opcional)</label>
            <input type="file" onChange={e => setArchivoFile(e.target.files?.[0] ?? null)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={creando} className="w-full bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {creando ? 'Creando...' : 'Crear período y generar cuentas'}
          </button>
        </form>
      </div>

      <h2 className="text-lg font-semibold mb-3">Períodos</h2>
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vencimiento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {periodos.map(p => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2 font-medium">{meses[p.mes - 1]} {p.anio}</td>
                <td className="px-4 py-2">${p.valor_mensual.toLocaleString('es-CL')}</td>
                <td className="px-4 py-2">{new Date(p.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL')}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.estado === 'abierto' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {p.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                  </span>
                </td>
                <td className="px-4 py-2"><Link href={`/comite/gastos-comunes/${p.id}`} className="text-blue-600 hover:underline">Ver cuentas</Link></td>
              </tr>
            ))}
            {periodos.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin períodos de GC aún</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
