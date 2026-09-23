import { forwardRef } from "react";
import type { FilaReporte } from "@/lib/actions/deposito";

export interface ReporteDepositoProps {
  fecha: string;
  filas: FilaReporte[];
  titulo?: string;
}

export const ReporteDeposito = forwardRef<HTMLDivElement, ReporteDepositoProps>(
  function ReporteDeposito({ fecha, filas, titulo = "REPORTE DE DEPÓSITO" }, ref) {
    return (
      <div
        ref={ref}
        className="bg-white text-black p-4 w-[720px] font-mono text-xs border border-neutral-300"
      >
        <div className="text-center mb-3">
          <div className="text-lg font-bold">VERDULERÍA ROGEL</div>
          <div className="text-sm">{titulo}</div>
          <div className="text-xs">Fecha: {fecha}</div>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1">Producto</th>
              <th className="text-right py-1">Apertura</th>
              <th className="text-right py-1">Entradas</th>
              <th className="text-right py-1">Devol.</th>
              <th className="text-right py-1">Salidas</th>
              <th className="text-right py-1">Ajustes</th>
              <th className="text-right py-1">Teórico</th>
              <th className="text-right py-1">Físico</th>
              <th className="text-right py-1">Dif.</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.productoId} className="border-b border-dashed border-neutral-300">
                <td className="py-1">
                  {f.nombre}
                  {f.variedad ? ` — ${f.variedad}` : ""}
                </td>
                <td className="text-right py-1">{f.apertura}</td>
                <td className="text-right py-1">{f.entradas}</td>
                <td className="text-right py-1">{f.devoluciones}</td>
                <td className="text-right py-1">{f.salidas}</td>
                <td className="text-right py-1">{f.ajustes}</td>
                <td className="text-right py-1 font-bold">{f.teorico}</td>
                <td className="text-right py-1">{f.fisico ?? "—"}</td>
                <td
                  className={`text-right py-1 ${
                    f.diferencia && f.diferencia !== 0 ? "font-bold text-red-600" : ""
                  }`}
                >
                  {f.diferencia ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
);
