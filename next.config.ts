import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit lee sus métricas de fuentes estándar (.afm) desde el disco en
  // tiempo de ejecución; sin esto, Vercel no incluye esos archivos en el
  // bundle serverless y el PDF falla con ENOENT.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/reportes/deudores": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/incidencias/[id]/pdf": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
