import { forwardRef } from "react";
import type { CierreDeCaja } from "@/lib/actions/caja";

export const ReporteCierreCaja = forwardRef<HTMLDivElement, CierreDeCaja>(function ReporteCierreCaja(
  { fecha, totalConciliado, cantidadConciliados, totalSinConciliar, cantidadSinConciliar, totalCancelados, cantidadCancelados },
  ref,
) {
  return (
    <div
      ref={ref}
      className="bg-white text-black p-4 w-[380px] font-mono text-sm border border-neutral-300"
    >
      <div className="text-center mb-3">
        <div className="text-lg font-bold">VERDULERÍA ROGEL</div>
        <div className="text-sm">CIERRE DE CAJA</div>
        <div className="text-xs">Fecha: {fecha}</div>
      </div>

      <div className="flex justify-between border-t border-b border-black py-2 font-bold text-base">
        <span>TOTAL COBRADO</span>
        <span>$ {totalConciliado}</span>
      </div>
      <div className="text-xs text-neutral-600 mb-3">{cantidadConciliados} cobro(s) conciliado(s)</div>

      {cantidadSinConciliar > 0 && (
        <div className="text-xs mb-2">
          <div className="flex justify-between">
            <span>Sin conciliar (revisar)</span>
            <span>$ {totalSinConciliar}</span>
          </div>
          <div className="text-neutral-500">{cantidadSinConciliar} cobro(s) sin pedido asociado</div>
        </div>
      )}

      {cantidadCancelados > 0 && (
        <div className="text-xs">
          <div className="flex justify-between">
            <span>Cancelados</span>
            <span>$ {totalCancelados}</span>
          </div>
          <div className="text-neutral-500">{cantidadCancelados} cobro(s) cancelado(s)</div>
        </div>
      )}
    </div>
  );
});
