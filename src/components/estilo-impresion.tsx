/**
 * Al imprimir, oculta todo menos el elemento marcado con className="imprimible"
 * y fija el tamaño de hoja. No depende de ninguna impresora en particular —
 * cualquier impresora WiFi que se agregue en el sistema operativo del
 * celular/tablet/PC va a aparecer sola en el diálogo de impresión del
 * navegador.
 */
export function EstiloImpresion({ tamano }: { tamano: "A5" | "A4" }) {
  return (
    <style>{`
      @page {
        size: ${tamano};
        margin: ${tamano === "A5" ? "10mm" : "15mm"};
      }
      @media print {
        body * {
          visibility: hidden;
        }
        .imprimible,
        .imprimible * {
          visibility: visible;
        }
        .imprimible {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
      }
    `}</style>
  );
}
