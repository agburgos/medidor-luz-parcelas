import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
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
    // Generar link de recuperación y enviarlo con Resend (no depende del envío nativo de Supabase)
    if (!parcela.email) return NextResponse.json({ error: 'La parcela no tiene email registrado' }, { status: 400 })
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Falta configurar RESEND_API_KEY para enviar correos' }, { status: 400 })
    }

    const { data: linkData, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: parcela.email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/bienvenida` },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: sendError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: parcela.email,
      subject: '🔑 COPOSA — Recupera tu contraseña',
      html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <h2 style="color:#1d4ed8;">🏘️ COPOSA</h2>
  <p>Hola <strong>${parcela.nombre_dueno}</strong>,</p>
  <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para crear una nueva:</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="${linkData.properties.action_link}" style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Restablecer contraseña</a>
  </p>
  <p style="font-size:13px;color:#6b7280;">Si el botón no funciona, copia y pega este link en tu navegador:</p>
  <p style="font-size:12px;color:#6b7280;word-break:break-all;">${linkData.properties.action_link}</p>
  <p style="font-size:13px;color:#6b7280;">Si no solicitaste esto, ignora este correo.</p>
</div>
      `,
    })
    if (sendError) return NextResponse.json({ error: `Falló el envío del correo: ${sendError.message}` }, { status: 400 })

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
