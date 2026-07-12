'use client'

import { useState, useEffect } from 'react'

interface Config {
  comunidad_id: string
  alertas_activas: boolean
  alerta_no_pago: boolean
  alerta_corte: boolean
  alerta_asamblea: boolean
  alerta_votacion: boolean
  modo_pruebas: boolean
  email_pruebas: string
  whatsapp_pruebas: string | null
  organizador_reunion_email: string
  dias_aviso_vencimiento: number
  dias_aviso_corte: number
  frecuencia_reenvio_dias: number
  max_por_dia: number
  dia_tope_lectura: number
  avisar_lectura_dias_antes: number
  porteria_email: string | null
  porteria_whatsapp: string | null
  comunidad?: { nombre: string }
}

function Switch({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${activo ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${activo ? 'left-7' : 'left-1'}`} />
    </button>
  )
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

  if (error) return <div className="p-8 text-red-600">{error} — ¿ejecutaste la migración 022 en Supabase?</div>
  if (!config) return <div className="p-8 text-gray-500">Cargando configuración...</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Configuración de alertas</h1>
      <p className="text-gray-500 text-sm mb-6">Macrolote: {config.comunidad?.nombre ?? 'COPOSA'}</p>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <form onSubmit={guardar} className="space-y-6">
        {/* Modo de pruebas */}
        <div className={`rounded-xl border p-6 ${config.modo_pruebas ? 'bg-amber-50 border-amber-300' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-medium">🧪 Modo de pruebas</p>
              <p className="text-sm text-gray-500">Mientras esté activo, TODOS los correos (de cualquier tipo) y el botón de pánico (email + WhatsApp) se envían solo a los datos de pruebas, nunca a los vecinos reales.</p>
            </div>
            <Switch activo={config.modo_pruebas} onClick={() => setConfig(c => c && { ...c, modo_pruebas: !c.modo_pruebas })} />
          </div>
          {config.modo_pruebas && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo de pruebas</label>
                <input
                  type="email"
                  value={config.email_pruebas}
                  onChange={e => setConfig(c => c && { ...c, email_pruebas: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp de pruebas (botón de pánico)</label>
                <input
                  type="text"
                  value={config.whatsapp_pruebas ?? ''}
                  onChange={e => setConfig(c => c && { ...c, whatsapp_pruebas: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                  placeholder="+56 9 1234 5678"
                />
              </div>
            </div>
          )}
        </div>

        {/* Switches individuales por tipo de correo */}
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <p className="font-medium mb-1">Tipos de correo</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">💰 Alerta de no pago</p>
              <p className="text-xs text-gray-500">Aviso de cuenta próxima a vencer o vencida</p>
            </div>
            <Switch activo={config.alerta_no_pago} onClick={() => setConfig(c => c && { ...c, alerta_no_pago: !c.alerta_no_pago })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">🚨 Alerta de corte de suministro</p>
              <p className="text-xs text-gray-500">Aviso de corte inminente por deuda</p>
            </div>
            <Switch activo={config.alerta_corte} onClick={() => setConfig(c => c && { ...c, alerta_corte: !c.alerta_corte })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">🗓️ Alerta de asamblea</p>
              <p className="text-xs text-gray-500">Aviso cuando se cita una nueva asamblea</p>
            </div>
            <Switch activo={config.alerta_asamblea} onClick={() => setConfig(c => c && { ...c, alerta_asamblea: !c.alerta_asamblea })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">🗳️ Alerta de votación</p>
              <p className="text-xs text-gray-500">Aviso cuando se abre una nueva votación</p>
            </div>
            <Switch activo={config.alerta_votacion} onClick={() => setConfig(c => c && { ...c, alerta_votacion: !c.alerta_votacion })} />
          </div>
        </div>

        {/* Portería — botón de pánico */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="font-medium mb-1">🚨 Portería — Alerta de pánico</p>
          <p className="text-xs text-gray-500 mb-3">
            Contacto que recibe la alerta cuando un parcelero activa el botón de pánico, junto con
            su ubicación y los datos de la parcela.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email de portería</label>
              <input
                type="email"
                value={config.porteria_email ?? ''}
                onChange={e => setConfig(c => c && { ...c, porteria_email: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm w-full"
                placeholder="porteria@coposa.cl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp de portería</label>
              <input
                type="text"
                value={config.porteria_whatsapp ?? ''}
                onChange={e => setConfig(c => c && { ...c, porteria_whatsapp: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm w-full"
                placeholder="+56 9 1234 5678"
              />
            </div>
          </div>
        </div>

        {/* Reuniones de directiva */}
        <div className="bg-white rounded-xl border p-6">
          <p className="font-medium mb-1">🗓️ Reuniones de directiva</p>
          <p className="text-xs text-gray-500 mb-3">
            Al crear una asamblea de tipo &quot;Directiva&quot;, se abre automáticamente Google Calendar
            con el evento y todos los miembros del comité invitados. Este correo queda como organizador.
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1">Correo organizador</label>
          <input
            type="email"
            value={config.organizador_reunion_email}
            onChange={e => setConfig(c => c && { ...c, organizador_reunion_email: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm w-full max-w-sm"
          />
        </div>

        {/* Envío automático diario (lectura/vencimiento/corte) */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium">Envío automático diario</p>
              <p className="text-sm text-gray-500">Interruptor general del cron que corre cada día a las 9 AM (recordatorio de lectura + los switches de arriba)</p>
            </div>
            <Switch activo={config.alertas_activas} onClick={() => setConfig(c => c && { ...c, alertas_activas: !c.alertas_activas })} />
          </div>

          <div className={config.alertas_activas ? '' : 'opacity-40 pointer-events-none'}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Día tope para subir lectura</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">día</span>
                  <input
                    type="number"
                    value={config.dia_tope_lectura}
                    onChange={e => setConfig(c => c && { ...c, dia_tope_lectura: Number(e.target.value) })}
                    min={1} max={28}
                    className="border rounded-lg px-3 py-2 text-sm w-20"
                  />
                  <span className="text-sm text-gray-500">de cada mes</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recordar lectura con anticipación</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.avisar_lectura_dias_antes}
                    onChange={e => setConfig(c => c && { ...c, avisar_lectura_dias_antes: Number(e.target.value) })}
                    min={0} max={15}
                    className="border rounded-lg px-3 py-2 text-sm w-20"
                  />
                  <span className="text-sm text-gray-500">días antes del tope</span>
                </div>
              </div>
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
