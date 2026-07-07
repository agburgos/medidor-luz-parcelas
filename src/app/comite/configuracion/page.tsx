'use client'

import { useState, useEffect } from 'react'

interface Config {
  comunidad_id: string
  alertas_activas: boolean
  dias_aviso_vencimiento: number
  dias_aviso_corte: number
  frecuencia_reenvio_dias: number
  max_por_dia: number
  comunidad?: { nombre: string }
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/config-alertas')
      .then(r => r.json())
      .then(data => data.error ? setError(data.error) : setConfig(data))
  }, [])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!config) return
    setGuardando(true)
    setMensaje('')
    const res = await fetch('/api/config-alertas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Configuración guardada' : `❌ ${data.error}`)
    setGuardando(false)
  }

  if (error) return <div className="p-8 text-red-600">{error} — ¿ejecutaste la migración 006 en Supabase?</div>
  if (!config) return <div className="p-8 text-gray-500">Cargando configuración...</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Configuración de alertas</h1>
      <p className="text-gray-500 text-sm mb-6">Macrolote: {config.comunidad?.nombre ?? 'COPOSA'}</p>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <form onSubmit={guardar} className="bg-white rounded-xl border p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Envío de alertas automáticas</p>
            <p className="text-sm text-gray-500">Correos de vencimiento y corte que salen cada día a las 9 AM</p>
          </div>
          <button
            type="button"
            onClick={() => setConfig(c => c && { ...c, alertas_activas: !c.alertas_activas })}
            className={`relative w-14 h-8 rounded-full transition-colors ${config.alertas_activas ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${config.alertas_activas ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className={config.alertas_activas ? '' : 'opacity-40 pointer-events-none'}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Avisar vencimiento con anticipación</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.dias_aviso_vencimiento}
                  onChange={e => setConfig(c => c && { ...c, dias_aviso_vencimiento: Number(e.target.value) })}
                  min={0} max={60}
                  className="border rounded-lg px-3 py-2 text-sm w-20"
                />
                <span className="text-sm text-gray-500">días antes</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Avisar corte con anticipación</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.dias_aviso_corte}
                  onChange={e => setConfig(c => c && { ...c, dias_aviso_corte: Number(e.target.value) })}
                  min={0} max={30}
                  className="border rounded-lg px-3 py-2 text-sm w-20"
                />
                <span className="text-sm text-gray-500">días antes</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repetir recordatorio cada</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.frecuencia_reenvio_dias}
                  onChange={e => setConfig(c => c && { ...c, frecuencia_reenvio_dias: Number(e.target.value) })}
                  min={0} max={30}
                  className="border rounded-lg px-3 py-2 text-sm w-20"
                />
                <span className="text-sm text-gray-500">días (0 = enviar una sola vez)</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Máximo de correos por día</label>
              <input
                type="number"
                value={config.max_por_dia}
                onChange={e => setConfig(c => c && { ...c, max_por_dia: Number(e.target.value) })}
                min={1} max={2000}
                className="border rounded-lg px-3 py-2 text-sm w-24"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </form>

      <div className="mt-6 bg-white rounded-xl border p-6">
        <h2 className="font-medium mb-2">Gestión de usuarios</h2>
        <p className="text-sm text-gray-500 mb-3">
          La administración de usuarios se hace desde el mantenedor de parcelas: invitar parceleros,
          reiniciar contraseñas, activar/desactivar parcelas y editar sus datos.
        </p>
        <a href="/comite/parcelas" className="text-blue-600 hover:underline text-sm">→ Ir al mantenedor de parcelas</a>
      </div>
    </div>
  )
}
