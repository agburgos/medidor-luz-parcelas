import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const fd = await req.formData()
  const file = fd.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf'

  const isPdf = mediaType === 'application/pdf'

  const content: Anthropic.MessageParam['content'] = isPdf
    ? [
        {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 },
        },
        {
          type: 'text' as const,
          text: `Eres un asistente que extrae datos de facturas de electricidad.
Analiza esta factura y responde ÚNICAMENTE con un JSON válido con estos campos:
{
  "monto": <número total a pagar en pesos, sin puntos ni comas>,
  "vencimiento": "<fecha en formato YYYY-MM-DD>",
  "corte": "<fecha de corte de suministro en YYYY-MM-DD o null si no aparece>",
  "emision": "<fecha de emisión en YYYY-MM-DD o null>"
}
Si no puedes leer algún campo, usa null. No incluyas explicaciones, solo el JSON.`,
        },
      ]
    : [
        {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 },
        },
        {
          type: 'text' as const,
          text: `Eres un asistente que extrae datos de facturas de electricidad.
Analiza esta imagen de factura y responde ÚNICAMENTE con un JSON válido con estos campos:
{
  "monto": <número total a pagar en pesos, sin puntos ni comas>,
  "vencimiento": "<fecha en formato YYYY-MM-DD>",
  "corte": "<fecha de corte de suministro en YYYY-MM-DD o null si no aparece>",
  "emision": "<fecha de emisión en YYYY-MM-DD o null>"
}
Si no puedes leer algún campo, usa null. No incluyas explicaciones, solo el JSON.`,
        },
      ]

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: 'No se pudo extraer datos de la factura' }, { status: 422 })

  const parsed = JSON.parse(jsonMatch[0])
  return NextResponse.json(parsed)
}
