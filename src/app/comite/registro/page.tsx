'use client'

import { useState, useEffect } from 'react'
import RegistroParcela from '@/components/registro/RegistroParcela'

interface ParcelaOpcion { id: string; numero: number; nombre_dueno: string }

export default function RegistroComitePage() {
  const [parcelas, setParcelas] = useState<ParcelaOpcion[]>([])
  const [seleccionada, setSeleccionada] = useState<string>('todas')

  useEffect(() => {
    fetch('/api/parcelas')
      .then(r => r.json())
      .then(data => setParcelas(Array.isArray(data) ? data : []))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Registro comunitario</h1>
          <p className="text-gray-500 text-sm">Personas y mascotas por parcela de todo el macrolote</p>
        </div>
        <select
          value={seleccionada}
          onChange={e => setSeleccionada(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm min-w-52"
        >
          <option value="todas">Todas las parcelas</option>
          {parcelas.map(p => (
            <option key={p.id} value={p.id}>#{p.numero} — {p.nombre_dueno}</option>
          ))}
        </select>
      </div>

      <RegistroParcela
        key={seleccionada}
        parcelaId={seleccionada === 'todas' ? undefined : seleccionada}
        mostrarParcela={seleccionada === 'todas'}
      />
    </div>
  )
}
