# Setup de Módulo de Caja y Tesorería

## Pasos para activar el módulo de Caja

### 1. Ejecutar la migración SQL en Supabase

**Opción A: Vía SQL Editor (recomendado)**

1. Abre [Supabase Dashboard](https://app.supabase.com/)
2. Selecciona tu proyecto COPOSA
3. Ve a **SQL Editor** (o **SQL** en el menú izquierdo)
4. Abre el archivo: `supabase/migration-015-caja.sql` en un editor de texto
5. Copia TODO el contenido
6. En Supabase SQL Editor, pega el SQL
7. Presiona **Cmd+Enter** (o **Ctrl+Enter** en Windows) para ejecutar

**Resultado esperado:**
- Tablas `caja_movimientos` y `caja_saldos` creadas
- Políticas de RLS aplicadas
- Saldo inicial de $169.158 registrado para 2026-07-01

**Opción B: Vía CLI (si tienes `supabase-cli`)**

```bash
supabase db push
```

### 2. Crear bucket de Storage para documentos

1. Abre [Supabase Dashboard](https://app.supabase.com/)
2. Selecciona tu proyecto COPOSA
3. Ve a **Storage** (en el menú izquierdo)
4. Haz click en **"Create a new bucket"**
5. Nombre: `documentos`
6. Privacidad: **Private** (solo el comité puede ver)
7. Haz click en **"Create bucket"**

### 3. Configurar políticas de Storage (opcional pero recomendado)

### 2. Acceder al módulo en la app

Una vez ejecutada la migración:

- **Comité:** Ve a `/comite/caja`
  - Registra ingresos y egresos
  - Accede al **Libro Contable** desde el botón en la esquina superior derecha

- **Funcionalidades:**
  - ✅ Registro de ingresos (con concepto, monto, fecha, documento opcional)
  - ✅ Registro de egresos (igual estructura)
  - ✅ Saldo actual en tiempo real (Inicial + Ingresos - Egresos)
  - ✅ Historial de movimientos recientes
  - ✅ **Libro Contable** con 3 vistas:
    1. **Estado de Resultados** — Saldo inicial + ingresos - egresos = saldo final
    2. **Resumen Mensual** — Ingresos/egresos agrupados por mes y concepto
    3. **Registro Cronológico** — Todos los movimientos ordenados por fecha con saldo acumulado
  - ✅ Impresión/PDF desde el libro contable

### 3. Datos iniciales

- **Saldo Inicial:** $169.158 (registrado en `caja_saldos` al 2026-07-01)
- **Primeros movimientos:** Los que registres manualmente en `/comite/caja`

### 4. Validación

Para verificar que todo funciona:

1. Abre http://localhost:3002/comite/caja (con sesión de comité)
2. Verifica que ves:
   - Saldo Inicial: $169.158
   - Total Ingresos: $0
   - Total Egresos: $0
   - Saldo Actual: $169.158
3. Registra un ingreso de prueba (ej: $50.000, "Arriendo")
4. Registra un egreso de prueba (ej: $45.000, "Pago IEL")
5. Verifica que el saldo se actualiza: $169.158 + $50.000 - $45.000 = $174.158
6. Abre el **Libro Contable** y verifica las 3 secciones

## Errores comunes

- **"Could not find the table 'public.caja_movimientos'"** → No ejecutaste la migración SQL aún
- **"No autorizado"** → Asegúrate de estar logueado como comité, no como parcelero
- El saldo no cambia → Recarga la página (F5) después de registrar un movimiento

## Notas

- Todos los movimientos quedan registrados en la bitácora (`bitacora` tabla)
- Los documentos son URLs (opcional), útiles para guardar enlaces a archivos en Storage
- El libro contable se genera automáticamente a partir de los movimientos
