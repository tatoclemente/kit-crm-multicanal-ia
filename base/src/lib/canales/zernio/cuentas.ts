import type { CuentaProveedor, Resultado } from "../tipos";
import { pedir } from "./cliente";
import { cuentaDesdeRest } from "./mapeo";
import type { RestCuenta } from "./tipos";

export async function listarCuentas(): Promise<Resultado<CuentaProveedor[]>> {
  const res = await pedir<{ data?: RestCuenta[]; accounts?: RestCuenta[] }>("/v1/accounts");
  if (!res.ok) return res;

  const crudas = res.data?.data ?? res.data?.accounts ?? [];
  const cuentas = crudas
    .map(cuentaDesdeRest)
    .filter((c): c is CuentaProveedor => c !== null);

  return { ok: true, data: cuentas };
}
