"use server";

import { getCurrentUsuario } from "@/lib/auth";
import {
  ajustarPagoExterno,
  corregirPagoExterno,
  ErrorPagoExterno,
  obtenerLedgerReserva,
  reenviarComprobantePagoExterno,
  registrarPagoExterno,
  type ActorPagoExterno,
} from "@/lib/negocio/pagosExternos.server";
import { revalidatePath } from "next/cache";

export type ResultadoPagoExternoAction = {
  ok: boolean;
  mensaje: string;
};

const METODOS = new Set(["EFECTIVO", "TRANSFERENCIA", "TERMINAL_EXTERNA", "OTRO"]);
const TIPOS_AJUSTE = new Set(["ANULACION", "REEMBOLSO"]);
const UUID_OPACO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function campo(formData: FormData, nombre: string, maximo = 100): string {
  const valor = formData.get(nombre);
  if (typeof valor !== "string") throw new Error("DATOS_INVALIDOS");
  const limpio = valor.trim();
  if (!limpio || limpio.length > maximo) throw new Error("DATOS_INVALIDOS");
  return limpio;
}

function campoOpcional(formData: FormData, nombre: string, maximo: number): string | undefined {
  const valor = formData.get(nombre);
  if (valor === null || valor === "") return undefined;
  if (typeof valor !== "string") throw new Error("DATOS_INVALIDOS");
  const limpio = valor.trim();
  if (limpio.length > maximo) throw new Error("DATOS_INVALIDOS");
  return limpio || undefined;
}

function dineroCentavos(formData: FormData, nombre: string): number {
  const valor = campo(formData, nombre, 20).replace(",", ".");
  if (!/^\d{1,11}(?:\.\d{1,2})?$/.test(valor)) throw new Error("MONTO_INVALIDO");
  const [enteros, decimales = ""] = valor.split(".");
  const centavos = Number(enteros) * 100 + Number(decimales.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos) || centavos <= 0) throw new Error("MONTO_INVALIDO");
  return centavos;
}

function fechaLocal(formData: FormData, nombre: string): Date {
  const valor = campo(formData, nombre, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(valor)) {
    throw new Error("FECHA_INVALIDA");
  }
  const fecha = new Date(valor);
  const [parteFecha, parteHora] = valor.split("T");
  const [año, mes, dia] = parteFecha.split("-").map(Number);
  const [hora, minuto] = parteHora.split(":").map(Number);
  const limiteInferior = new Date("2000-01-01T00:00:00.000Z");
  const limiteSuperior = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (
    Number.isNaN(fecha.getTime()) ||
    fecha.getFullYear() !== año ||
    fecha.getMonth() + 1 !== mes ||
    fecha.getDate() !== dia ||
    fecha.getHours() !== hora ||
    fecha.getMinutes() !== minuto ||
    fecha < limiteInferior ||
    fecha > limiteSuperior
  ) {
    throw new Error("FECHA_INVALIDA");
  }
  return fecha;
}

function idempotencia(formData: FormData): string {
  const valor = campo(formData, "idempotencyKey", 36);
  if (!UUID_OPACO.test(valor)) throw new Error("IDEMPOTENCIA_INVALIDA");
  return valor;
}

async function actorActual(): Promise<ActorPagoExterno> {
  const usuario = await getCurrentUsuario();
  if (!usuario) throw new Error("NO_AUTENTICADO");
  return {
    usuarioPropiedadId: usuario.id,
    propiedadId: usuario.propiedadId,
    rol: usuario.rol,
  };
}

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTENTICADO: "Tu sesión terminó. Vuelve a iniciar sesión.",
  DATOS_INVALIDOS: "Revisa los datos capturados.",
  MONTO_INVALIDO: "Captura un monto válido con máximo dos decimales.",
  FECHA_INVALIDA: "Captura una fecha y hora válidas.",
  IDEMPOTENCIA_INVALIDA: "Vuelve a abrir el formulario e inténtalo de nuevo.",
  ROL_PAGO_EXTERNO_DENEGADO: "Tu rol no permite modificar pagos externos.",
  PAGOS_EXTERNOS_DESHABILITADOS: "El registro de pagos externos no está habilitado.",
  RESERVA_NO_ENCONTRADA: "No se encontró la reserva.",
  PAGO_EXTERNO_NO_ENCONTRADO: "No se encontró el pago externo.",
  ESTADO_RESERVA_NO_ADMITE_COBRO: "El estado de la reserva no admite nuevos cobros.",
  SALDO_INSUFICIENTE: "El monto supera el saldo pendiente disponible.",
  AJUSTE_SUPERA_DISPONIBLE: "El ajuste supera el monto disponible del pago.",
  MOTIVO_AJUSTE_REQUERIDO: "Captura el motivo del ajuste.",
  IDEMPOTENCIA_CONFLICTO: "La operación ya fue utilizada para otro movimiento.",
  COMPROBANTE_NO_DISPONIBLE: "El comprobante no está disponible.",
  COMPROBANTE_NO_REENVIABLE: "Este comprobante todavía no se puede reenviar.",
};

function errorResultado(error: unknown): ResultadoPagoExternoAction {
  const codigo = error instanceof ErrorPagoExterno
    ? error.codigo
    : error instanceof Error
      ? error.message
      : "ERROR_DESCONOCIDO";
  return { ok: false, mensaje: MENSAJES_ERROR[codigo] ?? "No se pudo completar la operación." };
}

function refrescar(reservaId: string) {
  revalidatePath(`/panel/reservas/${reservaId}`);
}

export async function registrarPagoExternoAction(
  _estadoAnterior: ResultadoPagoExternoAction,
  formData: FormData
): Promise<ResultadoPagoExternoAction> {
  try {
    const actor = await actorActual();
    const reservaId = campo(formData, "reservaId");
    const metodo = campo(formData, "metodo", 30);
    if (!METODOS.has(metodo)) throw new Error("DATOS_INVALIDOS");
    await registrarPagoExterno(actor, {
      reservaId,
      montoCentavos: dineroCentavos(formData, "monto"),
      metodo: metodo as "EFECTIVO" | "TRANSFERENCIA" | "TERMINAL_EXTERNA" | "OTRO",
      fechaPago: fechaLocal(formData, "fechaPago"),
      nota: campoOpcional(formData, "nota", 500),
      enviarComprobante: formData.get("enviarComprobante") === "on",
      idempotencyKey: idempotencia(formData),
    });
    refrescar(reservaId);
    return { ok: true, mensaje: "Pago externo registrado." };
  } catch (error) {
    return errorResultado(error);
  }
}

export async function corregirPagoExternoAction(
  _estadoAnterior: ResultadoPagoExternoAction,
  formData: FormData
): Promise<ResultadoPagoExternoAction> {
  try {
    const actor = await actorActual();
    const reservaId = campo(formData, "reservaId");
    const metodo = campo(formData, "metodo", 30);
    if (!METODOS.has(metodo)) throw new Error("DATOS_INVALIDOS");
    await corregirPagoExterno(actor, {
      reservaId,
      pagoExternoId: campo(formData, "pagoExternoId"),
      nuevoMontoCentavos: dineroCentavos(formData, "monto"),
      metodo: metodo as "EFECTIVO" | "TRANSFERENCIA" | "TERMINAL_EXTERNA" | "OTRO",
      fechaPago: fechaLocal(formData, "fechaPago"),
      motivo: campo(formData, "motivo", 500),
      nota: campoOpcional(formData, "nota", 500),
      idempotencyKey: idempotencia(formData),
    });
    refrescar(reservaId);
    return { ok: true, mensaje: "Corrección registrada; el movimiento original permanece en la auditoría." };
  } catch (error) {
    return errorResultado(error);
  }
}

export async function ajustarPagoExternoAction(
  _estadoAnterior: ResultadoPagoExternoAction,
  formData: FormData
): Promise<ResultadoPagoExternoAction> {
  try {
    const actor = await actorActual();
    const reservaId = campo(formData, "reservaId");
    const tipo = campo(formData, "tipo", 20);
    if (!TIPOS_AJUSTE.has(tipo)) throw new Error("DATOS_INVALIDOS");
    await ajustarPagoExterno(actor, {
      reservaId,
      pagoExternoId: campo(formData, "pagoExternoId"),
      tipo: tipo as "ANULACION" | "REEMBOLSO",
      montoCentavos: dineroCentavos(formData, "monto"),
      motivo: campo(formData, "motivo", 500),
      idempotencyKey: idempotencia(formData),
    });
    refrescar(reservaId);
    return {
      ok: true,
      mensaje: tipo === "REEMBOLSO"
        ? "Reembolso asentado. Confirma que el hotel devolvió el dinero por fuera de Roomly."
        : "Anulación registrada.",
    };
  } catch (error) {
    return errorResultado(error);
  }
}

export async function reenviarComprobantePagoExternoAction(
  _estadoAnterior: ResultadoPagoExternoAction,
  formData: FormData
): Promise<ResultadoPagoExternoAction> {
  try {
    const actor = await actorActual();
    const reservaId = campo(formData, "reservaId");
    const pagoExternoId = campo(formData, "pagoExternoId");
    const ledger = await obtenerLedgerReserva(actor, reservaId);
    const pago = ledger.pagosExternos.find((movimiento) => movimiento.id === pagoExternoId);
    if (!pago) throw new ErrorPagoExterno("PAGO_EXTERNO_NO_ENCONTRADO");
    if (!["FALLIDO", "ENVIADO"].includes(pago.estadoComprobante)) {
      throw new Error("COMPROBANTE_NO_REENVIABLE");
    }
    await reenviarComprobantePagoExterno(actor, { reservaId, pagoExternoId });
    refrescar(reservaId);
    return { ok: true, mensaje: "Comprobante reenviado; no se registró otro pago." };
  } catch (error) {
    return errorResultado(error);
  }
}
