import { forwardRef } from "react";
import type { CierreDeCaja } from "@/lib/actions/caja";

const formatoMoneda = (v: string) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0 }).format(Number(v));

const ESTADO_ETIQUETA: Record<string, string> = {
  sin_conciliar: "sin conciliar",
  cancelado: "cancelado",
};

export const ReporteCierreCaja = forwardRef<HTMLDivElement, CierreDeCaja>(function ReporteCierreCaja(
  {
    fecha,
    totalConciliado,
    cantidadConciliados,
    totalSinConciliar,
    cantidadSinConciliar,
    totalCancelados,
    cantidadCancelados,
    detalle,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className="bg-white text-black p-4 w-[380px] font-mono text-sm border border-neutral-300"
    >
      <div className="text-center mb-2">
        <div className="text-lg font-bold">VERDULERÍA ROGEL</div>
        <div className="text-sm">CIERRE DE CAJA</div>
        <div className="text-xs">Fecha: {fecha}</div>
      </div>

      {detalle.length > 0 ? (
        <table className="w-full text-xs border-collapse mt-2">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1">Pedido</th>
              <th className="text-left py-1">Cliente</th>
              <th className="text-right py-1">Monto</th>
            </tr>
          </thead>
          <tbody>
            {detalle.map((c, i) => (
              <tr key={i} className="border-b border-dashed border-neutral-300 align-top">
                <td className="py-1">Nº {String(c.numeroPedido).padStart(3, "0")}</td>
                <td className="py-1">
                  {c.clienteNombre ?? "—"}
                  {ESTADO_ETIQUETA[c.estado] && (
                    <div className="text-[10px] text-neutral-500">
                      ({ESTADO_ETIQUETA[c.estado]})
                    </div>
                  )}
                </td>
                <td className="py-1 text-right">{formatoMoneda(c.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-xs text-neutral-500 text-center py-2">Sin cobros registrados.</div>
      )}

      <div className="flex justify-between mt-2 pt-2 border-t border-black font-bold text-base">
        <span>TOTAL COBRADO</span>
        <span>$ {formatoMoneda(totalConciliado)}</span>
      </div>
      <div className="text-xs text-neutral-600 mb-2">{cantidadConciliados} cobro(s) conciliado(s)</div>

      {cantidadSinConciliar > 0 && (
        <div className="text-xs mb-1">
          <div className="flex justify-between">
            <span>Sin conciliar (revisar)</span>
            <span>$ {formatoMoneda(totalSinConciliar)}</span>
          </div>
          <div className="text-neutral-500">{cantidadSinConciliar} cobro(s) sin pedido asociado</div>
        </div>
      )}

      {cantidadCancelados > 0 && (
        <div className="text-xs">
          <div className="flex justify-between">
            <span>Cancelados</span>
            <span>$ {formatoMoneda(totalCancelados)}</span>
          </div>
          <div className="text-neutral-500">{cantidadCancelados} cobro(s) cancelado(s)</div>
        </div>
      )}
    </div>
  );
});
