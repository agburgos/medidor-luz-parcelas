// Comprime una foto en el navegador antes de subirla, para evitar el límite
// de tamaño de body (~4.5MB) de las funciones serverless de Vercel. Las fotos
// de cámaras de celulares modernos suelen pesar 8-15MB sin esto.
export async function comprimirImagen(file: File, maxDimension = 1600, calidad = 0.8): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  let { width, height } = bitmap
  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', calidad))
  if (!blob) return file

  // Si por alguna razón la compresión no ayudó, mantener el original
  if (blob.size >= file.size) return file

  const nuevoNombre = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], nuevoNombre, { type: 'image/jpeg' })
}
