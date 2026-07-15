'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  generarSaltB64, generarIvB64, derivarClaveDesdePassword, exportarClaveDerivadaB64,
  generarVaultKey, exportarVaultKeyB64, envolverVaultKey, desenvolverVaultKey,
  cifrarItem, descifrarItem, ItemDescifrado,
} from '@/lib/crypto-vault'

interface EstadoVault {
  salt_maestra: string
  iv_maestra: string
  vault_key_wrapped_maestra: string
  created_at: string
}

interface EstadoVaults {
  general: EstadoVault | null
  tecnico?: EstadoVault | null
  recuperacion_configurada: boolean
}

interface ItemCifrado {
  id: string
  categoria: string
  iv: string
  datos_cifrados: string
  created_at: string
}

interface ItemUI extends ItemCifrado {
  descifrado: ItemDescifrado
  revelado: boolean
}

const CATEGORIAS: Record<string, Record<string, string>> = {
  general: { banco: '🏦 Banco', otro: '🔑 Otro' },
  tecnico: { tecnico: '⚙️ Servicio técnico' },
}

type Ambito = 'general' | 'tecnico'

export default function BovedaPage() {
  const [status, setStatus] = useState<EstadoVaults | null>(null)
  const [ambito, setAmbito] = useState<Ambito>('general')
  const [cargando, setCargando] = useState(true)

  const cargarStatus = useCallback(async () => {
    const res = await fetch('/api/boveda/vaults')
    const data = await res.json()
    if (res.ok) setStatus(data)
    setCargando(false)
  }, [])

  useEffect(() => { cargarStatus() }, [cargarStatus])

  if (cargando) return <div className="p-8 text-gray-500">Cargando...</div>
  if (!status) return <div className="p-8 text-red-600">No se pudo cargar la bóveda</div>

  const puedeTecnico = 'tecnico' in status

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">🔐 Bóveda de Claves</h1>
      <p className="text-gray-500 text-sm mb-6">Cifrado de extremo a extremo — la contraseña maestra nunca sale de tu navegador</p>

      {puedeTecnico && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setAmbito('general')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${ambito === 'general' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}
          >
            👥 General (comité)
          </button>
          <button
            onClick={() => setAmbito('tecnico')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${ambito === 'tecnico' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}
          >
            ⚙️ Técnica (superadmin)
          </button>
        </div>
      )}

      <BovedaAmbito
        key={ambito}
        ambito={ambito}
        estado={ambito === 'general' ? status.general : status.tecnico ?? null}
        recuperacionConfigurada={status.recuperacion_configurada}
        onCambio={cargarStatus}
        esSuperadmin={puedeTecnico}
      />
    </div>
  )
}

function BovedaAmbito({
  ambito, estado, recuperacionConfigurada, onCambio, esSuperadmin,
}: {
  ambito: Ambito
  estado: EstadoVault | null
  recuperacionConfigurada: boolean
  onCambio: () => void
  esSuperadmin: boolean
}) {
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null)
  const [items, setItems] = useState<ItemUI[]>([])
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [modo, setModo] = useState<'normal' | 'recuperar' | 'cambiar_password'>('normal')
  const [modalItem, setModalItem] = useState<ItemUI | 'nuevo' | null>(null)

  async function crearBoveda(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 10) { setError('Usa al menos 10 caracteres'); return }
    if (password !== password2) { setError('Las contraseñas no coinciden'); return }

    setProcesando(true)
    try {
      const salt = generarSaltB64()
      const iv = generarIvB64()
      const nuevaVaultKey = await generarVaultKey()
      const claveEnvoltura = await derivarClaveDesdePassword(password, salt)
      const wrapped = await envolverVaultKey(nuevaVaultKey, claveEnvoltura, iv)
      const rawB64 = await exportarVaultKeyB64(nuevaVaultKey)

      const res = await fetch('/api/boveda/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambito, salt_maestra: salt, iv_maestra: iv, vault_key_wrapped_maestra: wrapped, vault_key_raw_b64: rawB64 }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setProcesando(false); return }

      setVaultKey(nuevaVaultKey)
      setPassword(''); setPassword2('')
      onCambio()
    } catch {
      setError('Error creando la bóveda')
    }
    setProcesando(false)
  }

  async function desbloquear(e: React.FormEvent) {
    e.preventDefault()
    if (!estado) return
    setError('')
    setProcesando(true)
    try {
      const claveEnvoltura = await derivarClaveDesdePassword(password, estado.salt_maestra)
      const key = await desenvolverVaultKey(estado.vault_key_wrapped_maestra, claveEnvoltura, estado.iv_maestra)
      setVaultKey(key)
      setPassword('')
      await cargarItems(key)
    } catch {
      setError('Contraseña incorrecta')
    }
    setProcesando(false)
  }

  async function cargarItems(key: CryptoKey) {
    const res = await fetch(`/api/boveda/items?ambito=${ambito}`)
    const data: ItemCifrado[] = await res.json()
    if (!Array.isArray(data)) return
    const descifrados: ItemUI[] = []
    for (const it of data) {
      try {
        const descifrado = await descifrarItem(it.datos_cifrados, it.iv, key)
        descifrados.push({ ...it, descifrado, revelado: false })
      } catch {
        // ítem no descifrable con esta llave (no debería pasar); se omite
      }
    }
    setItems(descifrados)
  }

  async function cambiarPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!vaultKey || !estado) return
    setError('')
    if (password.length < 10) { setError('Usa al menos 10 caracteres'); return }
    if (password !== password2) { setError('Las contraseñas no coinciden'); return }

    setProcesando(true)
    try {
      const nuevaSalt = generarSaltB64()
      const nuevoIv = generarIvB64()
      const nuevaClaveEnvoltura = await derivarClaveDesdePassword(password, nuevaSalt)
      const nuevoWrapped = await envolverVaultKey(vaultKey, nuevaClaveEnvoltura, nuevoIv)

      const res = await fetch('/api/boveda/cambiar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambito, salt_maestra: nuevaSalt, iv_maestra: nuevoIv, vault_key_wrapped_maestra: nuevoWrapped }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setProcesando(false); return }

      setPassword(''); setPassword2(''); setModo('normal')
      onCambio()
    } catch {
      setError('Error cambiando la contraseña')
    }
    setProcesando(false)
  }

  async function recuperar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 10) { setError('Usa al menos 10 caracteres'); return }
    if (password !== password2) { setError('Las contraseñas no coinciden'); return }

    setProcesando(true)
    try {
      const nuevaSalt = generarSaltB64()
      const nuevoIv = generarIvB64()
      const nuevaClaveEnvoltura = await derivarClaveDesdePassword(password, nuevaSalt)
      const claveDerivadaRaw = await exportarClaveDerivadaB64(nuevaClaveEnvoltura)

      const res = await fetch('/api/boveda/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambito, nueva_salt_maestra: nuevaSalt, nuevo_iv_maestra: nuevoIv, nueva_clave_derivada_raw_b64: claveDerivadaRaw }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setProcesando(false); return }

      // Desbloquear de inmediato con la contraseña recién puesta
      const resStatus = await fetch('/api/boveda/vaults')
      const nuevoStatus = await resStatus.json()
      const nuevoEstado: EstadoVault = nuevoStatus[ambito]
      const key = await desenvolverVaultKey(nuevoEstado.vault_key_wrapped_maestra, nuevaClaveEnvoltura, nuevoEstado.iv_maestra)
      setVaultKey(key)
      setPassword(''); setPassword2(''); setModo('normal')
      onCambio()
      await cargarItems(key)
    } catch {
      setError('No se pudo recuperar el acceso')
    }
    setProcesando(false)
  }

  async function guardarItem(datos: ItemDescifrado, categoria: string, itemExistente: ItemUI | null) {
    if (!vaultKey) return
    const { iv, datos_cifrados } = await cifrarItem(datos, vaultKey)

    if (itemExistente) {
      const res = await fetch(`/api/boveda/items/${itemExistente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria, iv, datos_cifrados }),
      })
      if (res.ok) {
        setItems(prev => prev.map(i => i.id === itemExistente.id ? { ...i, categoria, iv, datos_cifrados, descifrado: datos } : i))
      }
    } else {
      const res = await fetch('/api/boveda/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambito, categoria, iv, datos_cifrados }),
      })
      const data = await res.json()
      if (res.ok) {
        setItems(prev => [{ ...data, descifrado: datos, revelado: false }, ...prev])
      }
    }
    setModalItem(null)
  }

  async function eliminarItem(item: ItemUI) {
    if (!confirm(`¿Eliminar "${item.descifrado.titulo}"?`)) return
    const res = await fetch(`/api/boveda/items/${item.id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== item.id))
  }

  async function revelar(item: ItemUI) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, revelado: !i.revelado } : i))
    if (!item.revelado) {
      fetch(`/api/boveda/items/${item.id}/registrar-acceso`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'ver' }),
      })
    }
  }

  async function copiar(item: ItemUI) {
    await navigator.clipboard.writeText(item.descifrado.secreto)
    fetch(`/api/boveda/items/${item.id}/registrar-acceso`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'copiar' }),
    })
  }

  // --- Pantallas ---

  if (!estado) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-bold mb-2">🆕 Configurar bóveda {ambito === 'general' ? 'General' : 'Técnica'}</h2>
        <p className="text-sm text-gray-500 mb-4">
          Elige una contraseña maestra fuerte. {ambito === 'general'
            ? 'Deberás compartirla con el resto del comité por un medio seguro (en persona o llamada, no por email/WhatsApp sin cifrar).'
            : 'Solo tú (superadmin) la necesitas conocer.'}
        </p>
        <form onSubmit={crearBoveda} className="space-y-3 max-w-sm">
          <input type="password" placeholder="Contraseña maestra" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input type="password" placeholder="Confirmar contraseña" value={password2} onChange={e => setPassword2(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={procesando} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {procesando ? 'Creando...' : 'Crear bóveda'}
          </button>
        </form>
      </div>
    )
  }

  if (!vaultKey) {
    if (modo === 'recuperar') {
      return (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-bold mb-2 text-red-600">🆘 Recuperar acceso</h2>
          <p className="text-sm text-gray-500 mb-4">
            Esto reemplaza la contraseña maestra actual usando el respaldo de recuperación del servidor.
            Solo hazlo si de verdad se perdió la contraseña — quedará registrado en la bitácora.
          </p>
          <form onSubmit={recuperar} className="space-y-3 max-w-sm">
            <input type="password" placeholder="Nueva contraseña maestra" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            <input type="password" placeholder="Confirmar nueva contraseña" value={password2} onChange={e => setPassword2(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button disabled={procesando} className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {procesando ? 'Recuperando...' : 'Recuperar acceso'}
              </button>
              <button type="button" onClick={() => { setModo('normal'); setError('') }} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
            </div>
          </form>
        </div>
      )
    }

    return (
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-bold mb-2">🔒 Bóveda bloqueada</h2>
        <form onSubmit={desbloquear} className="space-y-3 max-w-sm">
          <input type="password" placeholder="Contraseña maestra" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" autoFocus />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={procesando} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {procesando ? 'Desbloqueando...' : 'Desbloquear'}
          </button>
        </form>
        {esSuperadmin && recuperacionConfigurada && (
          <button onClick={() => { setModo('recuperar'); setError('') }} className="text-xs text-gray-400 hover:text-red-600 mt-4 block">
            ¿Olvidaste la contraseña? Recuperar acceso
          </button>
        )}
        {!esSuperadmin && (
          <p className="text-xs text-gray-400 mt-4">¿Olvidaste la contraseña? Pide a un superadmin que la recupere.</p>
        )}
      </div>
    )
  }

  if (modo === 'cambiar_password') {
    return (
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-bold mb-2">🔑 Cambiar contraseña maestra</h2>
        <form onSubmit={cambiarPassword} className="space-y-3 max-w-sm">
          <input type="password" placeholder="Nueva contraseña" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input type="password" placeholder="Confirmar nueva contraseña" value={password2} onChange={e => setPassword2(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button disabled={procesando} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {procesando ? 'Guardando...' : 'Cambiar'}
            </button>
            <button type="button" onClick={() => { setModo('normal'); setError('') }} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </form>
      </div>
    )
  }

  // Desbloqueada: listado + acciones
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
          🔓 Desbloqueada
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModo('cambiar_password')} className="text-sm text-gray-500 hover:text-gray-700">🔑 Cambiar contraseña</button>
          <button onClick={() => setModalItem('nuevo')} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">+ Nuevo ítem</button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Sin ítems guardados aún</div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{item.descifrado.titulo}</p>
                  <p className="text-xs text-gray-400">{CATEGORIAS[ambito]?.[item.categoria] ?? item.categoria}</p>
                </div>
                <div className="flex gap-2 text-sm">
                  <button onClick={() => setModalItem(item)} className="text-gray-400 hover:text-blue-600">✏️</button>
                  <button onClick={() => eliminarItem(item)} className="text-gray-400 hover:text-red-600">🗑️</button>
                </div>
              </div>
              <div className="mt-2 text-sm space-y-1">
                {item.descifrado.usuario && <p className="text-gray-600">👤 {item.descifrado.usuario}</p>}
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-mono">
                    {item.revelado ? item.descifrado.secreto : '••••••••••••'}
                  </span>
                  <button onClick={() => revelar(item)} className="text-xs text-blue-600 hover:underline">{item.revelado ? 'Ocultar' : 'Revelar'}</button>
                  <button onClick={() => copiar(item)} className="text-xs text-blue-600 hover:underline">Copiar</button>
                </div>
                {item.descifrado.url && <p className="text-gray-400 text-xs">{item.descifrado.url}</p>}
                {item.descifrado.notas && <p className="text-gray-500 text-xs whitespace-pre-wrap">{item.descifrado.notas}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalItem && (
        <ModalItem
          ambito={ambito}
          item={modalItem === 'nuevo' ? null : modalItem}
          onGuardar={guardarItem}
          onCerrar={() => setModalItem(null)}
        />
      )}
    </div>
  )
}

function ModalItem({
  ambito, item, onGuardar, onCerrar,
}: {
  ambito: Ambito
  item: ItemUI | null
  onGuardar: (datos: ItemDescifrado, categoria: string, item: ItemUI | null) => void
  onCerrar: () => void
}) {
  const [titulo, setTitulo] = useState(item?.descifrado.titulo ?? '')
  const [usuario, setUsuario] = useState(item?.descifrado.usuario ?? '')
  const [secreto, setSecreto] = useState(item?.descifrado.secreto ?? '')
  const [url, setUrl] = useState(item?.descifrado.url ?? '')
  const [notas, setNotas] = useState(item?.descifrado.notas ?? '')
  const [categoria, setCategoria] = useState(item?.categoria ?? Object.keys(CATEGORIAS[ambito])[0])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !secreto.trim()) return
    onGuardar({ titulo: titulo.trim(), usuario: usuario.trim() || undefined, secreto: secreto.trim(), url: url.trim() || undefined, notas: notas.trim() || undefined }, categoria, item)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{item ? 'Editar ítem' : 'Nuevo ítem'}</h2>
        <form onSubmit={submit} className="space-y-3">
          <input placeholder="Título (ej: Banco Estado cuenta corriente)" value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {Object.keys(CATEGORIAS[ambito]).length > 1 && (
            <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {Object.entries(CATEGORIAS[ambito]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <input placeholder="Usuario (opcional)" value={usuario} onChange={e => setUsuario(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Clave / secreto" value={secreto} onChange={e => setSecreto(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
          <input placeholder="URL (opcional)" value={url} onChange={e => setUrl(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <textarea placeholder="Notas (opcional)" value={notas} onChange={e => setNotas(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">Guardar</button>
            <button type="button" onClick={onCerrar} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
