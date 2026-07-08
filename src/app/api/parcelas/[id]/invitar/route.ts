import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('id, email, nombre_dueno, numero, user_id')
    .eq('id', id)
    .single()

  if (!parcela) return NextResponse.json({ error: 'Parcela no encontrada' }, { status: 404 })
  if (parcela.user_id) return NextResponse.json({ error: 'Esta parcela ya tiene un usuario vinculado' }, { status: 400 })
  if (!parcela.email) return NextResponse.json({ error: 'La parcela no tiene email registrado' }, { status: 400 })
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Falta configurar RESEND_API_KEY para enviar correos' }, { status: 400 })
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/bienvenida`

  // Generar el link de invitación (esto crea el usuario en Auth) sin depender
  // del envío de correo nativo de Supabase, que es lento/limitado en el plan gratuito.
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: parcela.email,
    options: { redirectTo },
  })

  let actionLink: string
  let userId: string

  if (linkError) {
    // Si el usuario ya existe en Auth, generar un link de recuperación y vincular
    if (linkError.message.includes('already been registered')) {
      const { data: usersData } = await supabase.auth.admin.listUsers()
      const existente = usersData?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === parcela.email.toLowerCase()
      )
      if (!existente) return NextResponse.json({ error: linkError.message }, { status: 400 })

      const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: parcela.email,
        options: { redirectTo },
      })
      if (recoveryError) return NextResponse.json({ error: recoveryError.message }, { status: 400 })

      actionLink = recoveryData.properties.action_link
      userId = existente.id
    } else {
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }
  } else {
    actionLink = linkData.properties.action_link
    userId = linkData.user.id
  }

  // Vincular usuario a la parcela
  await supabase.from('parcelas').update({ user_id: userId }).eq('id', id)

  // Enviar correo de invitación con Resend
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: sendError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: parcela.email,
    subject: '🏘️ Bienvenido a COPOSA — Activa tu cuenta',
    html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <h2 style="color:#1d4ed8;">🏘️ COPOSA</h2>
  <p>Hola <strong>${parcela.nombre_dueno}</strong>,</p>
  <p>Se ha creado tu acceso al sistema de gestión de tu parcela <strong>#${parcela.numero}</strong>.</p>
  <p>Haz clic en el siguiente botón para activar tu cuenta y crear tu contraseña:</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="${actionLink}" style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Activar mi cuenta</a>
  </p>
  <p style="font-size:13px;color:#6b7280;">Si el botón no funciona, copia y pega este link en tu navegador:</p>
  <p style="font-size:12px;color:#6b7280;word-break:break-all;">${actionLink}</p>
</div>
    `,
  })

  if (sendError) {
    return NextResponse.json({ error: `Usuario creado pero falló el envío del correo: ${sendError.message}` }, { status: 400 })
  }

  await registrarInvitacion(id, parcela.email)

  return NextResponse.json({ invitado: true, email: parcela.email })
}

async function registrarInvitacion(parcelaId: string, email: string) {
  const sesion = await getSesion()
  await registrar(sesion, 'invitar_parcela', 'parcela', parcelaId, { email })
}
