'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CerrarPeriodoBoton({
  periodoId, estado, prorrateoCalculado, esSuperadmin,
}: {
  periodoId: string
  estado: string
  prorrateoCalculado: boolean
  esSuperadmin: boolean
}) {
  const router = useRouter()
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  async function cerrar() {
    if (!confirm('¿Cerrar este período? Ya no se podrán registrar nuevas lecturas ni cambios de facturación.')) return
    setProcesando(true)
    setError('')
    const res = await fetch(`/api/periodos/${periodoId}/cerrar`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setProcesando(false); return }
    router.refresh()
  }

  async function reabrir() {
    if (!confirm('¿Reabrir este período?')) return
    setProcesando(true)
    setError('')
    const res = await fetch(`/api/periodos/${periodoId}/reabrir`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setProcesando(false); return }
    router.refresh()
  }

  if (estado === 'abierto') {
    return (
      <div>
        <button
          onClick={cerrar}
          disabled={procesando || !prorrateoCalculado}
          title={!prorrateoCalculado ? 'Primero calcula el prorrateo' : ''}
          className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {procesando ? 'Cerrando...' : '🔒 Cerrar período'}
        </button>
        {!prorrateoCalculado && <p className="text-xs text-gray-400 mt-1">Calcula el prorrateo antes de cerrar</p>}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  if (esSuperadmin) {
    return (
      <div>
        <button
          onClick={reabrir}
          disabled={procesando}
          className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
        >
          {procesando ? 'Reabriendo...' : '🔓 Reabrir período (superadmin)'}
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  return null
}
