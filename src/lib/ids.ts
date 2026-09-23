/** Genera el próximo código legible tipo "C-0001" / "P-0001" a partir del último existente. */
export function siguienteCodigo(prefijo: string, ultimoCodigo: string | undefined): string {
  const ultimoNumero = ultimoCodigo
    ? parseInt(ultimoCodigo.replace(`${prefijo}-`, ""), 10) || 0
    : 0;
  const siguiente = ultimoNumero + 1;
  return `${prefijo}-${String(siguiente).padStart(4, "0")}`;
}
