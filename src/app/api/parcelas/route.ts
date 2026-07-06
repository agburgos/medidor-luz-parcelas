import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('parcelas')
    .select('*')
    .order('numero')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json()

  const { numero, nombre_dueno, email, telefono } = body
  if (!numero || !nombre_dueno) {
    return NextResponse.json({ error: 'Número y nombre son requeridos' }, { status: 400 })
  }

  // Asignar a la comunidad por defecto
  const { data: comunidad } = await supabase
    .from('comunidades')
    .select('id')
    .eq('activa', true)
    .limit(1)
    .single()

  const { data, error } = await supabase
    .from('parcelas')
    .insert({
      numero: Number(numero),
      nombre_dueno,
      email: email ? email.toLowerCase().trim() : null,
      telefono: telefono || null,
      comunidad_id: comunidad?.id ?? null,
    })
    .select()
    .single()

  if (error) {
    const msg = error.message.includes('duplicate')
      ? 'Ya existe una parcela con ese número o email'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json(data)
}
