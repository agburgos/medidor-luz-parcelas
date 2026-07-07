import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await req.json().catch(() => ({}))
  const modo = body.modo === 'correo' ? 'correo' : 'temporal'

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('id, email, nombre_dueno, user_id')
    .eq('id', id)
    .single()

  if (!parcela) return NextResponse.json({ error: 'Parcela no encontrada' }, { status: 404 })
  if (!parcela.user_id) return NextResponse.json({ error: 'Esta parcela no tiene usuario. Usa "Invitar" primero.' }, { status: 400 })

  if (modo === 'correo') {
    // Enviar link de recuperación por correo
    if (!parcela.email) return NextResponse.json({ error: 'La parcela no tiene email registrado' }, { status: 400 })
    const { error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: parcela.email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/bienvenida` },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    const sesion = await getSesion()
    await registrar(sesion, 'reset_password_correo', 'parcela', id, { email: parcela.email })
    return NextResponse.json({ enviado: true, mensaje: `Correo de recuperación enviado a ${parcela.email}` })
  }

  // Generar contraseña temporal y asignarla directamente
  const tempPassword = randomBytes(6).toString('base64url') // ~8 caracteres seguros
  const { error } = await supabase.auth.admin.updateUserById(parcela.user_id, {
    password: tempPassword,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const sesion = await getSesion()
  await registrar(sesion, 'reset_password_temporal', 'parcela', id, { nombre_dueno: parcela.nombre_dueno })

  return NextResponse.json({
    password_temporal: tempPassword,
    mensaje: `Nueva contraseña temporal para ${parcela.nombre_dueno}. Comunícasela de forma segura.`,
  })
}
