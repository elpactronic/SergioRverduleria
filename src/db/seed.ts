import { getDb } from "./index";
import { clientes, productos } from "./schema";

async function seed() {
  const db = getDb();

  await db.insert(clientes).values([
    { codigo: "C-0001", nombre: "Alfredo" },
    { codigo: "C-0002", nombre: "Andrea" },
    { codigo: "C-0003", nombre: "Bachi" },
    { codigo: "C-0004", nombre: "Maribel" },
    { codigo: "C-0005", nombre: "Cesar" },
  ]);

  await db.insert(productos).values([
    { codigo: "P-0001", nombre: "Manzana", variedad: "Red", tipoStock: "libre", precioUnitario: "7000" },
    { codigo: "P-0002", nombre: "Zapallito", variedad: null, tipoStock: "libre", precioUnitario: "5800" },
    { codigo: "P-0003", nombre: "Banana", variedad: "Pinta", tipoStock: "controlado", precioUnitario: "4000" },
    { codigo: "P-0004", nombre: "Palta", variedad: "Cara", tipoStock: "controlado", precioUnitario: "4700" },
    { codigo: "P-0005", nombre: "Lechuga", variedad: null, tipoStock: "libre", precioUnitario: "1300" },
    { codigo: "P-0006", nombre: "Zanahoria", variedad: null, tipoStock: "libre", precioUnitario: "2700" },
    { codigo: "P-0007", nombre: "Naranja", variedad: "Jugo", tipoStock: "libre", precioUnitario: "1700" },
    { codigo: "P-0008", nombre: "Pera", variedad: null, tipoStock: "controlado", precioUnitario: "2000" },
    { codigo: "P-0009", nombre: "Tomate", variedad: "Perita", tipoStock: "controlado", precioUnitario: "6000" },
  ]);

  console.log("Seed completo.");
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
