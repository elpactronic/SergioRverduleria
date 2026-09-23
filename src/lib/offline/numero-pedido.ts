import { db } from "./db";

function hoyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Genera el próximo número de pedido corto para hoy, en el propio
 * dispositivo, sin depender de conexión. Válido en Fase 1 porque hay
 * un único dispositivo vendedor: no hay riesgo de colisión entre pares.
 */
export async function siguienteNumeroPedido(): Promise<{
  numero: number;
  fecha: string;
}> {
  const fecha = hoyLocal();
  const actual = await db.contadores.get(fecha);
  const numero = (actual?.ultimoNumero ?? 0) + 1;
  await db.contadores.put({ fecha, ultimoNumero: numero });
  return { numero, fecha };
}

/**
 * Sincroniza el contador local con el máximo número ya confirmado en el
 * servidor para hoy. Se llama al recuperar conexión para evitar reiniciar
 * en 001 si el almacenamiento local se perdió (reinstalación, caché
 * limpiada) pero el servidor ya tiene pedidos de hoy.
 */
export async function reconciliarContador(fecha: string, maxServidor: number) {
  const actual = await db.contadores.get(fecha);
  if (!actual || actual.ultimoNumero < maxServidor) {
    await db.contadores.put({ fecha, ultimoNumero: maxServidor });
  }
}
