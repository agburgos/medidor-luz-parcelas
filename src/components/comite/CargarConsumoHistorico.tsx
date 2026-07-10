'use client'

import { useState } from 'react'

interface ConsumoData {
  parcela_id: number
  lectura_anterior: number
  lectura_actual: number
  kwh: number
}

export default function CargarConsumoHistorico() {
  const [mes, setMes] = useState('')
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [descripcion, setDescripcion] = useState('')
  const [datos, setDatos] = useState<ConsumoData[]>([])
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  // Parsear entrada de texto (formato: parcela lectura_anterior lectura_actual)
  function parsearDatos(texto: string) {
    const lineas = texto.split('\n').filter(l => l.trim())
    const consumos: ConsumoData[] = []

    lineas.forEach(linea => {
      const partes = linea.trim().split(/\s+/)
      if (partes.length >= 3) {
        const parcela_id = parseInt(partes[0])
        const lectura_anterior = parseInt(partes[1])
        const lectura_actual = parseInt(partes[2])

        if (!isNaN(parcela_id) && !isNaN(lectura_anterior) && !isNaN(lectura_actual)) {
          const kwh = Math.max(0, lectura_actual - lectura_anterior)
          consumos.push({ parcela_id, lectura_anterior, lectura_actual, kwh })
        }
      }
    })

    return consumos
  }

  async function cargar() {
    if (!mes || !anio || datos.length === 0) {
      setMensaje('❌ Faltan datos (mes, año, consumos)')
      return
    }

    setCargando(true)
    setMensaje('')

    const res = await fetch('/api/comite/consumo-historico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consumos: datos,
        mes: parseInt(mes),
        anio: parseInt(anio),
        periodo_descripcion: descripcion,
      }),
    })

    const data = await res.json()
    setCargando(false)

    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
      return
    }

    setMensaje(`✅ Cargados ${data.cantidad} consumos para ${data.periodo}`)
    setDatos([])
  }

  return (
    <div className="bg-white rounded-xl border p-6 max-w-2xl">
      <h2 className="text-lg font-bold mb-4">📊 Cargar Consumo Histórico</h2>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Mes (1-12)</label>
            <input
              type="number"
              min="1"
              max="12"
              value={mes}
              onChange={e => setMes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              placeholder="2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Año</label>
            <input
              type="number"
              value={anio}
              onChange={e => setAnio(parseInt(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Descripción (ej: "ENE26 A FEB26")</label>
          <input
            type="text"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            placeholder="Período"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Datos (parcela lectura_anterior lectura_actual, uno por línea)</label>
          <textarea
            rows={8}
            placeholder="1 3300 3530&#10;4 1590 1699&#10;5 7567 7724"
            onPaste={e => {
              const texto = e.clipboardData.getData('text')
              const nuevos = parsearDatos(texto)
              setDatos([...datos, ...nuevos])
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono text-xs"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
          💡 Pega los datos del PDF aquí. Formato: <code className="bg-white px-1">parcela lectura_anterior lectura_actual</code>
        </div>

        {datos.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium mb-2">✓ {datos.length} consumos listos para cargar</p>
            <div className="text-xs text-gray-600 max-h-32 overflow-y-auto">
              {datos.slice(0, 5).map((c, i) => (
                <div key={i}>
                  Parcela {c.parcela_id}: {c.kwh} kWh
                </div>
              ))}
              {datos.length > 5 && <div>... y {datos.length - 5} más</div>}
            </div>
          </div>
        )}

        {mensaje && (
          <div className={`text-sm rounded-lg p-3 ${mensaje.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {mensaje}
          </div>
        )}

        <button
          onClick={cargar}
          disabled={cargando || datos.length === 0}
          className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {cargando ? 'Cargando...' : '📤 Cargar Consumos'}
        </button>
      </div>
    </div>
  )
}
