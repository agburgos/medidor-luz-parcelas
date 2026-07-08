import { comprimirImagen } from '@/lib/comprimirImagen'

export const TIPOS_MENSAJE: Record<string, { label: string; icon: string; color: string }> = {
  reclamo: { label: 'Reclamo', icon: '⚠️', color: 'bg-amber-100 text-amber-700' },
  denuncia: { label: 'Denuncia', icon: '🚨', color: 'bg-red-100 text-red-700' },
  sugerencia: { label: 'Sugerencia', icon: '💡', color: 'bg-blue-100 text-blue-700' },
  felicitacion: { label: 'Felicitación', icon: '🎉', color: 'bg-green-100 text-green-700' },
}

export const ESTADOS_MENSAJE: Record<string, { label: string; color: string }> = {
  abierto: { label: 'Abierto', color: 'bg-gray-100 text-gray-700' },
  respondido: { label: 'Respondido', color: 'bg-blue-100 text-blue-700' },
  cerrado: { label: 'Cerrado', color: 'bg-gray-200 text-gray-500' },
}

// Sube un adjunto (foto o archivo) al bucket 'archivos', comprimiendo si es imagen.
// Usado tanto por el mensaje inicial como por cada réplica del hilo.
export async function subirAdjuntoMensaje(archivo: File): Promise<string> {
  const esImagen = archivo.type.startsWith('image/')
  const finalFile = esImagen ? await comprimirImagen(archivo) : archivo
  const fd = new FormData()
  fd.append('file', finalFile)
  fd.append('bucket', 'archivos')
  fd.append('folder', 'mensajes')
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error al subir adjunto')
  return data.url
}
