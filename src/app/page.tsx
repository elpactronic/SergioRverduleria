"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setSesion } from "@/lib/session";

export default function Home() {
  const router = useRouter();

  function entrar(rol: "vendedor" | "cajero", usuario: string, destino: string) {
    setSesion(rol, usuario);
    router.push(destino);
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-6 bg-neutral-50">
      <h1 className="text-2xl font-bold">Verdulería Rogel</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => entrar("vendedor", "V1", "/vendedor")}>
              Tomar pedidos
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Caja</CardTitle>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => entrar("cajero", "C1", "/caja")}>
              Registrar cobros
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="flex gap-4 text-sm text-neutral-500">
        <a href="/productos" className="underline">
          Productos
        </a>
        <a href="/clientes" className="underline">
          Clientes
        </a>
        <a href="/deposito" className="underline">
          Depósito
        </a>
      </div>
    </main>
  );
}
