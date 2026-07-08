import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// POST: subir archivo a Storage (votaciones)
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const bucket = (formData.get('bucket') as string) || 'votaciones'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const supabase = createServiceClient()

  // Generar nombre único
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const fileName = `${timestamp}-${random}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

  // Subir archivo
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Obtener URL pública
  const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(fileName)

  return NextResponse.json({ url: publicUrl.publicUrl })
}
