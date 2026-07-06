# Sistema de Prorrateo de Luz — Parcelas

Web app para gestionar el consumo eléctrico compartido de 80 parcelas: lectura de medidores con OCR, prorrateo automático, estados de pago y alertas por correo.

## Configuración inicial

### 1. Supabase
1. Crea cuenta en [supabase.com](https://supabase.com) → nuevo proyecto.
2. SQL Editor → ejecutar `supabase/schema.sql` completo.
3. Storage → crear bucket **`archivos`** (público).
4. Settings → API → copiar URL, anon key y service_role key.

### 2. Anthropic (OCR)
Crear API key en [console.anthropic.com](https://console.anthropic.com).

### 3. Resend (correos)
Crear cuenta en [resend.com](https://resend.com) → generar API key → verificar dominio.

### 4. Variables de entorno
```bash
cp .env.local.example .env.local
# Completar todas las variables
```

### 5. Correr local
```bash
npm install && npm run dev
```

## Cargar las 80 parcelas
1. Editar `scripts/parcelas.csv` con datos reales.
2. `npx ts-node scripts/seed-parcelas.ts`

## Crear usuario comité
1. Supabase → Authentication → Users → crear usuario del comité.
2. SQL: `UPDATE perfiles SET rol = 'comite' WHERE id = 'uuid';`

## Flujo comité
1. Nuevo período → subir factura → OCR sugiere monto/fechas → confirmar.
2. Subir fotos de medidores → OCR sugiere lectura → confirmar/corregir.
3. Calcular prorrateo → genera 80 cuentas automáticamente.
4. Marcar pagos: Pagado / Pago parcial / Mora por parcela.
5. Enviar alertas por correo a morosos/pendientes.

## Cron de alertas (Vercel)
`vercel.json` configura ejecución diaria a las 9 AM: envía correos de vencimiento (≤5 días) y corte (≤3 días).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
