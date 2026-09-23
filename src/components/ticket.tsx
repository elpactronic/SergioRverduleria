import { forwardRef } from "react";

export interface TicketItem {
  detalle: string;
  cantidadBultos: string;
  precioUnitario: string;
  total: string;
}

export interface TicketProps {
  numeroPedido: number;
  fecha: string;
  clienteNombre: string;
  items: TicketItem[];
  total: string;
}

const formatoMoneda = (v: string) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0 }).format(Number(v));

export const Ticket = forwardRef<HTMLDivElement, TicketProps>(function Ticket(
  { numeroPedido, fecha, clienteNombre, items, total },
  ref,
) {
  return (
    <div
      ref={ref}
      className="bg-white text-black p-4 w-[380px] font-mono text-sm border border-neutral-300"
    >
      <div className="text-center mb-2">
        <div className="text-lg font-bold">VERDULERÍA ROGEL</div>
        <div className="text-xs">PEDIDO Nº {String(numeroPedido).padStart(3, "0")}</div>
      </div>
      <div className="text-xs mb-2">
        <div>Cliente: {clienteNombre}</div>
        <div>Fecha: {fecha}</div>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1">Cant</th>
            <th className="text-left py-1">Detalle</th>
            <th className="text-right py-1">Precio</th>
            <th className="text-right py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-dashed border-neutral-300">
              <td className="py-1">{item.cantidadBultos}</td>
              <td className="py-1">{item.detalle}</td>
              <td className="py-1 text-right">{formatoMoneda(item.precioUnitario)}</td>
              <td className="py-1 text-right">{formatoMoneda(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between mt-2 pt-2 border-t border-black font-bold">
        <span>TOTAL</span>
        <span>$ {formatoMoneda(total)}</span>
      </div>
      <div className="text-[10px] text-center mt-3 text-neutral-500">
        Presentar este ticket en caja para abonar y retirar
      </div>
    </div>
  );
});
