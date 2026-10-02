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
  pago_id?: string | null
  pago_gc_id?: string | null
  cuenta_id: string
  transferencia_id: string | null
}

interface CuentaCaja { id: string; nombre: string; tipo: string; saldo: number }

export default function CajaPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    tipo: 'ingreso' as 'ingreso' | 'egreso',
    concepto: '',
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    documento: null as File | null,
    observacion: '',
    cuenta_id: '',
  })
  const [nombreDoc, setNombreDoc] = useState('')
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'egreso' | 'transferencia'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 15
  const [esSuperadmin, setEsSuperadmin] = useState(false)
  const [saldoInicial, setSaldoInicial] = useState<number | null>(null)
  const [editandoSaldo, setEditandoSaldo] = useState(false)
  const [nuevoSaldo, setNuevoSaldo] = useState('')
  const [guardandoSaldo, setGuardandoSaldo] = useState(false)
  const [cuentas, setCuentas] = useState<CuentaCaja[]>([])
  const [totalCuentas, setTotalCuentas] = useState(0)
  const [transf, setTransf] = useState({
    origen_id: '', destino_id: '', monto: '', fecha: new Date().toISOString().slice(0, 10), observacion: '',
    documento: null as File | null,
  })
  const [transfiriendo, setTransfiriendo] = useState(false)
  const [nuevaCuenta, setNuevaCuenta] = useState('')

  const cargar = useCallback(async () => {
    const res = await fetch('/api/caja/movimientos')
    const data = await res.json()
    setMovimientos(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  const cargarCuentas = useCallback(async () => {
    const res = await fetch('/api/caja/cuentas')
    const data = await res.json()
    if (Array.isArray(data.cuentas)) {
      setCuentas(data.cuentas)
      setTotalCuentas(data.total ?? 0)
    }
  }, [])

  const cargarSaldoInicial = useCallback(async () => {
    const res = await fetch('/api/caja/saldo-inicial')
    const data = await res.json()
    setSaldoInicial(data.saldo_inicial ?? 0)
  }, [])

  useEffect(() => {
    fetch('/api/sesion').then(r => r.json()).then(s => setEsSuperadmin(!!s.esSuperadmin)).catch(() => {})
  }, [])

  useEffect(() => {
    cargar()
    cargarSaldoInicial()
    cargarCuentas()
  }, [cargar, cargarSaldoInicial, cargarCuentas])

  async function guardarSaldoInicial() {
    const valor = Number(nuevoSaldo)
    if (isNaN(valor)) { alert('Monto inválido'); return }
    setGuardandoSaldo(true)
    const res = await fetch('/api/caja/saldo-inicial', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saldo_inicial: valor }),
    })
    if (res.ok) {
      setEditandoSaldo(false)
      await cargarSaldoInicial()
    } else {
      const data = await res.json()
      alert('Error: ' + data.error)
    }
    setGuardandoSaldo(false)
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.concepto || !form.monto || !form.fecha) {
      setMensaje('❌ Concepto, monto y fecha son requeridos')
      return
    }
    setGuardando(true)
    setMensaje('')

    const formData = new FormData()
    formData.append('tipo', form.tipo)
    formData.append('concepto', form.concepto)
    formData.append('monto', form.monto)
    formData.append('fecha', form.fecha)
    formData.append('observacion', form.observacion)
    if (form.documento) formData.append('documento', form.documento)
    if (form.cuenta_id) formData.append('cuenta_id', form.cuenta_id)

    const res = await fetch('/api/caja/movimientos', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
    } else {
      setMensaje(`✅ ${form.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado`)
      setForm({ tipo: 'ingreso', concepto: '', monto: '', fecha: new Date().toISOString().slice(0, 10), documento: null, observacion: '', cuenta_id: '' })
      setNombreDoc('')
      await Promise.all([cargar(), cargarCuentas()])
    }
    setGuardando(false)
  }

  async function transferir(e: React.FormEvent) {
    e.preventDefault()
    setTransfiriendo(true)
    setMensaje('')
    const fd = new FormData()
    fd.append('origen_id', transf.origen_id)
    fd.append('destino_id', transf.destino_id)
    fd.append('monto', transf.monto)
    fd.append('fecha', transf.fecha)
    fd.append('observacion', transf.observacion)
    if (transf.documento) fd.append('documento', transf.documento)
    const res = await fetch('/api/caja/transferencias', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) {
      setMensaje(`❌ ${data.error}`)
    } else {
      setMensaje('✅ Transferencia interna registrada')
      setTransf(t => ({ ...t, monto: '', observacion: '', documento: null }))
      await Promise.all([cargar(), cargarCuentas()])
    }
    setTransfiriendo(false)
  }

  async function crearCuenta() {
    if (!nuevaCuenta.trim()) return
    const res = await fetch('/api/caja/cuentas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevaCuenta }),
    })
    const data = await res.json()
    setMensaje(res.ok ? `✅ Cuenta "${data.nombre}" creada` : `❌ ${data.error}`)
    if (res.ok) { setNuevaCuenta(''); await cargarCuentas() }
  }

  async function eliminarMovimiento(m: Movimiento) {
    if (!confirm(`¿Eliminar el movimiento "${m.concepto}" por ${'$' + Math.round(m.monto).toLocaleString('es-CL')}?`)) return
    setEliminando(m.id)
    const res = await fetch(`/api/caja/movimientos/${m.id}`, { method: 'DELETE' })
    const data = await res.json()
    setMensaje(res.ok ? '✅ Movimiento eliminado' : `❌ ${data.error}`)
    if (res.ok) await Promise.all([cargar(), cargarCuentas()])
    setEliminando(null)
  }

  // Cuenta cuántos movimientos comparten el mismo pago_id/pago_gc_id — si hay
  // más de uno es un duplicado real (p. ej. doble clic al validar) y sí se
  // puede borrar el sobrante sin perder el registro del pago.
  const conteoPorPago = new Map<string, number>()
  for (const m of movimientos) {
    const clave = m.pago_id ? `p:${m.pago_id}` : m.pago_gc_id ? `g:${m.pago_gc_id}` : null
    if (clave) conteoPorPago.set(clave, (conteoPorPago.get(clave) ?? 0) + 1)
  }
  const esDuplicadoDePago = (m: Movimiento) => {
    const clave = m.pago_id ? `p:${m.pago_id}` : m.pago_gc_id ? `g:${m.pago_gc_id}` : null
    return !!clave && (conteoPorPago.get(clave) ?? 0) > 1
  }

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')
  // Las transferencias internas no cuentan como ingreso ni egreso.
  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso' && !m.transferencia_id).reduce((s, m) => s + Number(m.monto), 0)
  const totalEgresos = movimientos.filter(m => m.tipo === 'egreso' && !m.transferencia_id).reduce((s, m) => s + Number(m.monto), 0)
  const saldoActual = cuentas.length > 0 ? totalCuentas : (saldoInicial ?? 0) + totalIngresos - totalEgresos
  const nombreCuenta = (id: string) => cuentas.find(c => c.id === id)?.nombre ?? '—'

  // Filtrado + paginación de la grilla de movimientos
  const q = busqueda.trim().toLowerCase()
  const filtrados = movimientos.filter(m =>
    (filtroTipo === 'todos' || (filtroTipo === 'transferencia' ? !!m.transferencia_id : m.tipo === filtroTipo && !m.transferencia_id)) &&
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
          <p className="text-gray-500 text-sm">Registro de ingresos y egresos de la comunidad</p>
        </div>
        <Link
          href="/comite/caja/libro-contable"
          className="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-700"
        >
          📊 Libro Contable
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Saldo Inicial</p>
            {esSuperadmin && !editandoSaldo && (
              <button
                onClick={() => { setNuevoSaldo(String(saldoInicial ?? 0)); setEditandoSaldo(true) }}
                className="text-xs text-blue-600 hover:underline"
              >
                ✏️ Editar
              </button>
            )}
          </div>
          {editandoSaldo ? (
            <div className="mt-1">
              <input
                type="number"
                value={nuevoSaldo}
                onChange={e => setNuevoSaldo(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={guardarSaldoInicial}
                  disabled={guardandoSaldo}
                  className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700 disabled:opacity-50"
                >
                  {guardandoSaldo ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => setEditandoSaldo(false)}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xl font-bold text-blue-700">{saldoInicial === null ? '...' : $(saldoInicial)}</p>
          )}
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

      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-6 mb-4">
        <p className="text-sm opacity-90">Saldo total (suma de todas las cuentas)</p>
        <p className="text-4xl font-bold">{$(saldoActual)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {cuentas.map(c => (
          <div key={c.id} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">{c.tipo === 'diaria' ? '🏦' : c.tipo === 'deposito' ? '📈' : '💼'} {c.nombre}</p>
            <p className="text-xl font-bold text-blue-700">{$(c.saldo)}</p>
          </div>
        ))}
        <div className="bg-white rounded-xl border border-dashed p-4 flex items-center gap-2">
          <input
            type="text" value={nuevaCuenta} onChange={e => setNuevaCuenta(e.target.value)}
            placeholder="+ Nueva cuenta" className="flex-1 border rounded-lg px-2 py-1.5 text-sm min-w-0"
          />
          <button type="button" onClick={crearCuenta} className="text-xs bg-gray-700 text-white rounded-lg px-3 py-1.5 hover:bg-gray-800">Crear</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-1">🔁 Transferencia interna</h2>
        <p className="text-xs text-gray-500 mb-4">Mueve plata entre cuentas (ej. de Caja diaria a Depósito a plazo). No es ingreso ni gasto: el total no cambia.</p>
        <form onSubmit={transferir} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Desde</label>
              <select value={transf.origen_id} onChange={e => setTransf(t => ({ ...t, origen_id: e.target.value }))} required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Elegir cuenta…</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({$(c.saldo)})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hacia</label>
              <select value={transf.destino_id} onChange={e => setTransf(t => ({ ...t, destino_id: e.target.value }))} required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Elegir cuenta…</option>
                {cuentas.filter(c => c.id !== transf.origen_id).map(c => <option key={c.id} value={c.id}>{c.nombre} ({$(c.saldo)})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Monto $</label>
              <input type="number" value={transf.monto} onChange={e => setTransf(t => ({ ...t, monto: e.target.value }))} required min={1} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha</label>
              <input type="date" value={transf.fecha} onChange={e => setTransf(t => ({ ...t, fecha: e.target.value }))} required className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Observación</label>
              <input type="text" value={transf.observacion} onChange={e => setTransf(t => ({ ...t, observacion: e.target.value }))} placeholder="Ej: Depósito a plazo 90 días, Banco X" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Comprobante (opcional)</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setTransf(t => ({ ...t, documento: e.target.files?.[0] || null }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" disabled={transfiriendo} className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {transfiriendo ? 'Transfiriendo...' : '🔁 Transferir'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Nuevo Movimiento</h2>
        {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

        <form onSubmit={registrar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'ingreso' | 'egreso' }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="ingreso">📥 Ingreso</option>
                <option value="egreso">📤 Egreso</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Concepto</label>
              <input
                type="text"
                value={form.concepto}
                onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                required
                placeholder="Ej: Pago IEL, Arriendo espacio"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Monto $</label>
              <input
                type="number"
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                required min={1}
                placeholder="0"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cuenta</label>
            <select
              value={form.cuenta_id}
              onChange={e => setForm(f => ({ ...f, cuenta_id: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">{cuentas.find(c => c.tipo === 'diaria')?.nombre ?? 'Caja diaria'} (por defecto)</option>
              {cuentas.filter(c => c.tipo !== 'diaria').map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Para intereses u otros ingresos/gastos de una cuenta específica.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Documento (archivo opcional)</label>
            <input
              type="file"
              onChange={e => {
                const file = e.target.files?.[0]
                setForm(f => ({ ...f, documento: file || null }))
                setNombreDoc(file?.name || '')
              }}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            {nombreDoc && <p className="text-xs text-gray-500 mt-1">📎 {nombreDoc}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observación</label>
            <textarea
              value={form.observacion}
              onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))}
              placeholder="Comentarios adicionales..."
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Registrando...' : 'Registrar Movimiento'}
          </button>
        </form>
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
              onChange={e => { setFiltroTipo(e.target.value as 'todos' | 'ingreso' | 'egreso' | 'transferencia'); setPagina(1) }}
              className="border rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="ingreso">📥 Ingresos</option>
              <option value="egreso">📤 Egresos</option>
              <option value="transferencia">🔁 Transferencias</option>
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
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cuenta</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Monto</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Observación</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-3">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-CL')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        m.transferencia_id ? 'bg-indigo-100 text-indigo-700' : m.tipo === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {m.transferencia_id ? '🔁 Transferencia' : m.tipo === 'ingreso' ? '📥 Ingreso' : '📤 Egreso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{m.concepto}</td>
                    <td className="px-4 py-3 text-gray-500">{nombreCuenta(m.cuenta_id)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{$(Number(m.monto))}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {m.documento_url && (
                        <a href={m.documento_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          📎 Descargar
                        </a>
                      )}
                      {!m.documento_url && (m.observacion ? `"${m.observacion}"` : '—')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!esSuperadmin ? (
                        <span className="text-gray-300 text-xs" title="Solo el superadministrador puede eliminar movimientos">🔒</span>
                      ) : (m.pago_id || m.pago_gc_id) && !esDuplicadoDePago(m) ? (
                        <span className="text-gray-300 text-xs" title="Vinculado a un pago; elimínalo desde la cuenta">🔒</span>
                      ) : (
                        <button
                          onClick={() => eliminarMovimiento(m)}
                          disabled={eliminando === m.id}
                          className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-40"
                          title={esDuplicadoDePago(m) ? 'Duplicado del mismo pago — se puede eliminar el sobrante' : undefined}
                        >
                          {eliminando === m.id ? '...' : '🗑️'}
                        </button>
                      )}
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
