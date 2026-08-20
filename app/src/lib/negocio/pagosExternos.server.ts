import type { Prisma, RolUsuario } from "@prisma/client";
import { prisma } from "../prisma";
import { puedeMutarPagosExternos } from "./permisosPagosExternos";
import { aCentavos, aMxn, calcularResumenFinanciero } from "./resumenFinanciero";
import { enviarComprobantePago } from "../emails";

export type ActorPagoExterno = {
  usuarioPropiedadId: string;
  propiedadId: string;
  rol: RolUsuario;
};

export type RegistrarPagoExternoInput = {
  reservaId: string;
  montoCentavos: number;
  metodo: "EFECTIVO" | "TRANSFERENCIA" | "TERMINAL_EXTERNA" | "OTRO";
  fechaPago: Date;
  nota?: string;
  enviarComprobante: boolean;
  idempotencyKey: string;
};

export type CorregirPagoExternoInput = {
  reservaId: string;
  pagoExternoId: string;
  nuevoMontoCentavos: number;
  metodo: RegistrarPagoExternoInput["metodo"];
  fechaPago: Date;
  motivo: string;
  nota?: string;
  idempotencyKey: string;
};

export type AjustarPagoExternoInput = {
  reservaId: string;
  pagoExternoId: string;
  tipo: "ANULACION" | "REEMBOLSO";
  montoCentavos: number;
  motivo: string;
  idempotencyKey: string;
};

export type AjustePagoExternoLedger = {
  id: string;
  pagoExternoId: string;
  tipo: "ANULACION" | "REEMBOLSO";
  montoCentavos: number;
  motivo: string;
  creadoPorUsuarioId: string | null;
  idempotencyKey: string;
  creadoEn: Date;
};

export type PagoExternoLedger = {
  id: string;
  propiedadId: string;
  reservaId: string;
  montoCentavos: number;
  metodo: RegistrarPagoExternoInput["metodo"];
  fechaPago: Date;
  nota: string | null;
  creadoPorUsuarioId: string | null;
  idempotencyKey: string;
  reemplazaPagoExternoId: string | null;
  estadoComprobante: "NO_SOLICITADO" | "PENDIENTE" | "ENVIADO" | "FALLIDO";
  comprobanteEnviadoEn?: Date | null;
  comprobanteError?: string | null;
  ajustes: AjustePagoExternoLedger[];
  creadoEn: Date;
};

export type PagoStripeLedger = {
  id: string;
  cobradoCentavos: number;
  reembolsadoCentavos: number;
  reembolsoPendienteCentavos: number;
  creadoEn: Date;
};

export type DatosLedgerReserva = {
  reserva: {
    id: string;
    propiedadId: string;
    estado: "PENDIENTE_PAGO" | "CONFIRMADA" | "EN_CURSO" | "COMPLETADA" | "CANCELADA" | "NO_SHOW";
    totalReservaCentavos: number;
  };
  pagosStripe: PagoStripeLedger[];
  pagosExternos: PagoExternoLedger[];
};

export type NuevoPagoExterno = Omit<PagoExternoLedger, "id" | "ajustes" | "creadoEn">;
export type NuevoAjustePagoExterno = Omit<AjustePagoExternoLedger, "id" | "creadoEn">;

export type ResultadoIdempotenciaPagoExterno = {
  pago: PagoExternoLedger | null;
  ajuste: (AjustePagoExternoLedger & {
    propiedadId: string;
    reservaId: string;
  }) | null;
};

export type TransaccionPagosExternos = {
  adquirirLockReserva(reservaId: string): Promise<void>;
  adquirirLockIdempotencia(idempotencyKey: string): Promise<void>;
  buscarResultadoIdempotencia(
    idempotencyKey: string
  ): Promise<ResultadoIdempotenciaPagoExterno>;
  cargarLedgerReserva(
    propiedadId: string,
    reservaId: string
  ): Promise<DatosLedgerReserva | null>;
  crearPagoExterno(data: NuevoPagoExterno): Promise<PagoExternoLedger>;
  crearAjustePagoExterno(data: NuevoAjustePagoExterno): Promise<AjustePagoExternoLedger>;
};

export type RepositorioPagosExternos = {
  cargarActor(
    usuarioPropiedadId: string,
    propiedadId: string
  ): Promise<ActorPagoExterno | null>;
  transaccion<T>(trabajo: (tx: TransaccionPagosExternos) => Promise<T>): Promise<T>;
  leerLedgerReserva(
    propiedadId: string,
    reservaId: string
  ): Promise<DatosLedgerReserva | null>;
  leerDatosComprobante?(
    propiedadId: string,
    reservaId: string,
    pagoExternoId: string
  ): Promise<DatosComprobantePagoExterno | null>;
  actualizarEstadoComprobante?(
    pagoExternoId: string,
    data: ActualizacionComprobantePago
  ): Promise<PagoExternoLedger>;
};

export type DatosComprobantePagoExterno = {
  pago: PagoExternoLedger;
  ledger: DatosLedgerReserva;
  destinatario: {
    emailHuesped: string;
    codigoReserva: string;
    nombreHuesped: string;
    nombreHotel: string;
    tipoHabitacion: string;
    fechaIngreso: Date;
    fechaSalida: Date;
    numPersonas: number;
    colorPrimario?: string;
  };
};

export type ActualizacionComprobantePago = {
  estadoComprobante: "PENDIENTE" | "ENVIADO" | "FALLIDO";
  comprobanteEnviadoEn: Date | null;
  comprobanteError: string | null;
};

export class ErrorPagoExterno extends Error {
  constructor(readonly codigo: string) {
    super(codigo);
    this.name = "ErrorPagoExterno";
  }
}

type ConfiguracionPagosExternos = {
  ledgerHabilitado: () => boolean;
  enviarComprobante?: typeof enviarComprobantePago;
  registrarErrorComprobante?: (detalle: {
    pagoExternoId: string;
    nombreError: string;
  }) => void;
};

const ERROR_COMPROBANTE_SANITIZADO =
  "No fue posible enviar el comprobante. Intenta nuevamente.";

export function crearServicioPagosExternos(
  repositorio: RepositorioPagosExternos,
  configuracion: ConfiguracionPagosExternos
) {
  async function validarEscritura(actorSolicitado: ActorPagoExterno) {
    const actor = await repositorio.cargarActor(
      actorSolicitado.usuarioPropiedadId,
      actorSolicitado.propiedadId
    );
    if (!actor || !puedeMutarPagosExternos(actor.rol)) {
      throw new ErrorPagoExterno("ROL_PAGO_EXTERNO_DENEGADO");
    }
    if (!configuracion.ledgerHabilitado()) {
      throw new ErrorPagoExterno("PAGOS_EXTERNOS_DESHABILITADOS");
    }
    return actor;
  }

  function calcularResumen(ledger: DatosLedgerReserva) {
    return calcularResumenFinanciero({
      totalReservaCentavos: ledger.reserva.totalReservaCentavos,
      pagosStripe: ledger.pagosStripe,
      pagosExternos: ledger.pagosExternos.map((pago) => ({
        cobradoCentavos: pago.montoCentavos,
        ajustesCentavos: pago.ajustes.reduce(
          (total, ajuste) => total + ajuste.montoCentavos,
          0
        ),
      })),
    });
  }

  async function procesarComprobante(
    propiedadId: string,
    reservaId: string,
    pago: PagoExternoLedger,
    forzarReenvio = false
  ): Promise<PagoExternoLedger> {
    if (
      !configuracion.enviarComprobante ||
      !repositorio.leerDatosComprobante ||
      !repositorio.actualizarEstadoComprobante
    ) {
      return pago;
    }
    if (pago.estadoComprobante === "ENVIADO" && !forzarReenvio) return pago;

    const datos = await repositorio.leerDatosComprobante(
      propiedadId,
      reservaId,
      pago.id
    );
    if (!datos) throw new ErrorPagoExterno("PAGO_EXTERNO_NO_ENCONTRADO");

    await repositorio.actualizarEstadoComprobante(pago.id, {
      estadoComprobante: "PENDIENTE",
      comprobanteEnviadoEn: null,
      comprobanteError: null,
    });
    const resumen = calcularResumen(datos.ledger);
    try {
      await configuracion.enviarComprobante({
        ...datos.destinatario,
        montoRecibidoCentavos: datos.pago.montoCentavos,
        totalPagadoCentavos: resumen.pagadoNetoCentavos,
        totalReservaCentavos: resumen.totalReservaCentavos,
        saldoPendienteCentavos: resumen.saldoPendienteCentavos,
      });
      return repositorio.actualizarEstadoComprobante(pago.id, {
        estadoComprobante: "ENVIADO",
        comprobanteEnviadoEn: new Date(),
        comprobanteError: null,
      });
    } catch (error) {
      configuracion.registrarErrorComprobante?.({
        pagoExternoId: pago.id,
        nombreError: error instanceof Error ? error.name : "ErrorDesconocido",
      });
      return repositorio.actualizarEstadoComprobante(pago.id, {
        estadoComprobante: "FALLIDO",
        comprobanteEnviadoEn: null,
        comprobanteError: ERROR_COMPROBANTE_SANITIZADO,
      });
    }
  }

  return {
    async obtenerLedgerReserva(actor: ActorPagoExterno, reservaId: string) {
      const actorAutorizado = await repositorio.cargarActor(
        actor.usuarioPropiedadId,
        actor.propiedadId
      );
      if (!actorAutorizado) throw new ErrorPagoExterno("ROL_PAGO_EXTERNO_DENEGADO");
      const ledger = await repositorio.leerLedgerReserva(
        actorAutorizado.propiedadId,
        reservaId
      );
      if (!ledger) throw new ErrorPagoExterno("RESERVA_NO_ENCONTRADA");
      return { ...ledger, resumen: calcularResumen(ledger) };
    },

    async registrarPagoExterno(actor: ActorPagoExterno, input: RegistrarPagoExternoInput) {
      actor = await validarEscritura(actor);

      const pago = await repositorio.transaccion(async (tx) => {
        await tx.adquirirLockReserva(input.reservaId);
        await tx.adquirirLockIdempotencia(input.idempotencyKey);
        const resultadoIdempotencia = await tx.buscarResultadoIdempotencia(
          input.idempotencyKey
        );
        if (resultadoIdempotencia.ajuste) {
          throw new ErrorPagoExterno("IDEMPOTENCIA_CONFLICTO");
        }
        if (resultadoIdempotencia.pago) {
          if (
            resultadoIdempotencia.pago.propiedadId !== actor.propiedadId ||
            resultadoIdempotencia.pago.reservaId !== input.reservaId ||
            resultadoIdempotencia.pago.reemplazaPagoExternoId !== null
          ) {
            throw new ErrorPagoExterno("IDEMPOTENCIA_CONFLICTO");
          }
          return resultadoIdempotencia.pago;
        }

        const ledger = await tx.cargarLedgerReserva(actor.propiedadId, input.reservaId);
        if (!ledger) throw new ErrorPagoExterno("RESERVA_NO_ENCONTRADA");

        const resumen = calcularResumen(ledger);
        if (["CANCELADA", "NO_SHOW", "COMPLETADA"].includes(ledger.reserva.estado)) {
          throw new ErrorPagoExterno("ESTADO_RESERVA_NO_ADMITE_COBRO");
        }
        if (
          !Number.isSafeInteger(input.montoCentavos) ||
          input.montoCentavos <= 0 ||
          input.montoCentavos > resumen.saldoPendienteCentavos
        ) {
          throw new ErrorPagoExterno("SALDO_INSUFICIENTE");
        }

        return tx.crearPagoExterno({
          propiedadId: actor.propiedadId,
          reservaId: ledger.reserva.id,
          montoCentavos: input.montoCentavos,
          metodo: input.metodo,
          fechaPago: input.fechaPago,
          nota: input.nota?.trim() || null,
          creadoPorUsuarioId: actor.usuarioPropiedadId,
          idempotencyKey: input.idempotencyKey,
          reemplazaPagoExternoId: null,
          estadoComprobante: input.enviarComprobante ? "PENDIENTE" : "NO_SOLICITADO",
        });
      });
      return input.enviarComprobante
        ? procesarComprobante(actor.propiedadId, input.reservaId, pago)
        : pago;
    },

    async reenviarComprobantePagoExterno(
      actor: ActorPagoExterno,
      input: { reservaId: string; pagoExternoId: string }
    ) {
      actor = await validarEscritura(actor);
      if (!repositorio.leerDatosComprobante) {
        throw new ErrorPagoExterno("COMPROBANTE_NO_DISPONIBLE");
      }
      const datos = await repositorio.leerDatosComprobante(
        actor.propiedadId,
        input.reservaId,
        input.pagoExternoId
      );
      if (!datos) throw new ErrorPagoExterno("PAGO_EXTERNO_NO_ENCONTRADO");
      return procesarComprobante(
        actor.propiedadId,
        input.reservaId,
        datos.pago,
        true
      );
    },

    async corregirPagoExterno(actor: ActorPagoExterno, input: CorregirPagoExternoInput) {
      actor = await validarEscritura(actor);

      return repositorio.transaccion(async (tx) => {
        await tx.adquirirLockReserva(input.reservaId);
        await tx.adquirirLockIdempotencia(input.idempotencyKey);
        const {
          pago: reemplazoExistente,
          ajuste: anulacionExistente,
        } = await tx.buscarResultadoIdempotencia(input.idempotencyKey);
        if (reemplazoExistente && anulacionExistente) {
          if (
            reemplazoExistente.propiedadId !== actor.propiedadId ||
            reemplazoExistente.reservaId !== input.reservaId ||
            reemplazoExistente.reemplazaPagoExternoId !== input.pagoExternoId ||
            anulacionExistente.propiedadId !== actor.propiedadId ||
            anulacionExistente.reservaId !== input.reservaId ||
            anulacionExistente.pagoExternoId !== input.pagoExternoId ||
            anulacionExistente.tipo !== "ANULACION"
          ) {
            throw new ErrorPagoExterno("IDEMPOTENCIA_CONFLICTO");
          }
          return { anulacion: anulacionExistente, reemplazo: reemplazoExistente };
        }
        if (reemplazoExistente || anulacionExistente) {
          throw new ErrorPagoExterno("IDEMPOTENCIA_CONFLICTO");
        }

        const ledger = await tx.cargarLedgerReserva(actor.propiedadId, input.reservaId);
        if (!ledger) throw new ErrorPagoExterno("PAGO_EXTERNO_NO_ENCONTRADO");
        const original = ledger.pagosExternos.find(
          (pago) => pago.id === input.pagoExternoId
        );
        if (!original) throw new ErrorPagoExterno("PAGO_EXTERNO_NO_ENCONTRADO");

        calcularResumen(ledger);
        const montoDisponible = original.montoCentavos - original.ajustes.reduce(
          (total, ajuste) => total + ajuste.montoCentavos,
          0
        );
        if (montoDisponible <= 0) {
          throw new ErrorPagoExterno("AJUSTE_SUPERA_DISPONIBLE");
        }
        if (!input.motivo.trim()) {
          throw new ErrorPagoExterno("MOTIVO_AJUSTE_REQUERIDO");
        }

        const ledgerTrasAnulacion: DatosLedgerReserva = {
          ...ledger,
          pagosExternos: ledger.pagosExternos.map((pago) =>
            pago.id === original.id
              ? {
                  ...pago,
                  ajustes: [
                    ...pago.ajustes,
                    {
                      id: "validacion",
                      pagoExternoId: pago.id,
                      tipo: "ANULACION",
                      montoCentavos: montoDisponible,
                      motivo: input.motivo,
                      creadoPorUsuarioId: actor.usuarioPropiedadId,
                      idempotencyKey: input.idempotencyKey,
                      creadoEn: new Date(0),
                    },
                  ],
                }
              : pago
          ),
        };
        const saldoTrasAnulacion = calcularResumen(ledgerTrasAnulacion).saldoPendienteCentavos;
        if (
          !Number.isSafeInteger(input.nuevoMontoCentavos) ||
          input.nuevoMontoCentavos <= 0 ||
          input.nuevoMontoCentavos > saldoTrasAnulacion
        ) {
          throw new ErrorPagoExterno("SALDO_INSUFICIENTE");
        }

        const anulacion = await tx.crearAjustePagoExterno({
          pagoExternoId: original.id,
          tipo: "ANULACION",
          montoCentavos: montoDisponible,
          motivo: input.motivo.trim(),
          creadoPorUsuarioId: actor.usuarioPropiedadId,
          idempotencyKey: input.idempotencyKey,
        });
        const reemplazo = await tx.crearPagoExterno({
          propiedadId: actor.propiedadId,
          reservaId: input.reservaId,
          montoCentavos: input.nuevoMontoCentavos,
          metodo: input.metodo,
          fechaPago: input.fechaPago,
          nota: input.nota?.trim() || null,
          creadoPorUsuarioId: actor.usuarioPropiedadId,
          idempotencyKey: input.idempotencyKey,
          reemplazaPagoExternoId: original.id,
          estadoComprobante: "NO_SOLICITADO",
        });
        return { anulacion, reemplazo };
      });
    },

    async ajustarPagoExterno(actor: ActorPagoExterno, input: AjustarPagoExternoInput) {
      actor = await validarEscritura(actor);

      return repositorio.transaccion(async (tx) => {
        await tx.adquirirLockReserva(input.reservaId);
        await tx.adquirirLockIdempotencia(input.idempotencyKey);
        const resultadoIdempotencia = await tx.buscarResultadoIdempotencia(
          input.idempotencyKey
        );
        if (resultadoIdempotencia.pago) {
          throw new ErrorPagoExterno("IDEMPOTENCIA_CONFLICTO");
        }
        if (resultadoIdempotencia.ajuste) {
          const existente = resultadoIdempotencia.ajuste;
          if (
            existente.propiedadId !== actor.propiedadId ||
            existente.reservaId !== input.reservaId ||
            existente.pagoExternoId !== input.pagoExternoId ||
            existente.tipo !== input.tipo
          ) {
            throw new ErrorPagoExterno("IDEMPOTENCIA_CONFLICTO");
          }
          return existente;
        }

        const ledger = await tx.cargarLedgerReserva(actor.propiedadId, input.reservaId);
        if (!ledger) throw new ErrorPagoExterno("PAGO_EXTERNO_NO_ENCONTRADO");
        const original = ledger.pagosExternos.find(
          (pago) => pago.id === input.pagoExternoId
        );
        if (!original) throw new ErrorPagoExterno("PAGO_EXTERNO_NO_ENCONTRADO");

        calcularResumen(ledger);
        const montoDisponible = original.montoCentavos - original.ajustes.reduce(
          (total, ajuste) => total + ajuste.montoCentavos,
          0
        );
        if (!input.motivo.trim()) {
          throw new ErrorPagoExterno("MOTIVO_AJUSTE_REQUERIDO");
        }
        const montoValido = Number.isSafeInteger(input.montoCentavos) &&
          input.montoCentavos > 0 &&
          input.montoCentavos <= montoDisponible;
        if (
          !montoValido ||
          (input.tipo === "ANULACION" && input.montoCentavos !== montoDisponible)
        ) {
          throw new ErrorPagoExterno("AJUSTE_SUPERA_DISPONIBLE");
        }

        return tx.crearAjustePagoExterno({
          pagoExternoId: original.id,
          tipo: input.tipo,
          montoCentavos: input.montoCentavos,
          motivo: input.motivo.trim(),
          creadoPorUsuarioId: actor.usuarioPropiedadId,
          idempotencyKey: input.idempotencyKey,
        });
      });
    },
  };
}

type PagoExternoPrisma = Prisma.PagoExternoGetPayload<{
  include: { ajustes: true };
}>;

function mapearAjustePrisma(
  ajuste: Prisma.AjustePagoExternoGetPayload<Record<string, never>>
): AjustePagoExternoLedger {
  return {
    id: ajuste.id,
    pagoExternoId: ajuste.pagoExternoId,
    tipo: ajuste.tipo,
    montoCentavos: aCentavos(Number(ajuste.montoMxn)),
    motivo: ajuste.motivo,
    creadoPorUsuarioId: ajuste.creadoPorUsuarioId,
    idempotencyKey: ajuste.idempotencyKey,
    creadoEn: ajuste.creadoEn,
  };
}

function mapearPagoExternoPrisma(pago: PagoExternoPrisma): PagoExternoLedger {
  return {
    id: pago.id,
    propiedadId: pago.propiedadId,
    reservaId: pago.reservaId,
    montoCentavos: aCentavos(Number(pago.montoMxn)),
    metodo: pago.metodo,
    fechaPago: pago.fechaPago,
    nota: pago.nota,
    creadoPorUsuarioId: pago.creadoPorUsuarioId,
    idempotencyKey: pago.idempotencyKey,
    reemplazaPagoExternoId: pago.reemplazaPagoExternoId,
    estadoComprobante: pago.estadoComprobante,
    comprobanteEnviadoEn: pago.comprobanteEnviadoEn,
    comprobanteError: pago.comprobanteError,
    ajustes: pago.ajustes.map(mapearAjustePrisma),
    creadoEn: pago.creadoEn,
  };
}

type ClienteLecturaLedger = Pick<Prisma.TransactionClient, "reserva">;

async function cargarLedgerPrisma(
  cliente: ClienteLecturaLedger,
  propiedadId: string,
  reservaId: string
): Promise<DatosLedgerReserva | null> {
  const reserva = await cliente.reserva.findFirst({
    where: { id: reservaId, propiedadId },
    select: {
      id: true,
      propiedadId: true,
      estado: true,
      totalMxn: true,
      pagosOnline: {
        orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
        select: {
          id: true,
          montoMxn: true,
          montoReembolsadoMxn: true,
          reembolsoPendienteMxn: true,
          creadoEn: true,
        },
      },
      pagosExternos: {
        orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
        include: {
          ajustes: { orderBy: [{ creadoEn: "asc" }, { id: "asc" }] },
        },
      },
    },
  });
  if (!reserva) return null;

  return {
    reserva: {
      id: reserva.id,
      propiedadId: reserva.propiedadId,
      estado: reserva.estado,
      totalReservaCentavos: aCentavos(Number(reserva.totalMxn)),
    },
    pagosStripe: reserva.pagosOnline.map((pago) => ({
      id: pago.id,
      cobradoCentavos: aCentavos(Number(pago.montoMxn)),
      reembolsadoCentavos: aCentavos(Number(pago.montoReembolsadoMxn)),
      reembolsoPendienteCentavos: aCentavos(Number(pago.reembolsoPendienteMxn)),
      creadoEn: pago.creadoEn,
    })),
    pagosExternos: reserva.pagosExternos.map(mapearPagoExternoPrisma),
  };
}
function crearTransaccionPrisma(tx: Prisma.TransactionClient): TransaccionPagosExternos {
  return {
    async adquirirLockReserva(reservaId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${reservaId}, 19))`;
    },
    async adquirirLockIdempotencia(idempotencyKey) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 20))`;
    },
    async buscarResultadoIdempotencia(idempotencyKey) {
      const [pago, ajuste] = await Promise.all([
        tx.pagoExterno.findUnique({
          where: { idempotencyKey },
          include: { ajustes: true },
        }),
        tx.ajustePagoExterno.findUnique({
          where: { idempotencyKey },
          include: {
            pagoExterno: {
              select: { propiedadId: true, reservaId: true },
            },
          },
        }),
      ]);
      return {
        pago: pago ? mapearPagoExternoPrisma(pago) : null,
        ajuste: ajuste
          ? {
              ...mapearAjustePrisma(ajuste),
              propiedadId: ajuste.pagoExterno.propiedadId,
              reservaId: ajuste.pagoExterno.reservaId,
            }
          : null,
      };
    },
    cargarLedgerReserva(propiedadId, reservaId) {
      return cargarLedgerPrisma(tx, propiedadId, reservaId);
    },
    async crearPagoExterno(data) {
      const pago = await tx.pagoExterno.create({
        data: {
          propiedadId: data.propiedadId,
          reservaId: data.reservaId,
          montoMxn: aMxn(data.montoCentavos),
          metodo: data.metodo,
          fechaPago: data.fechaPago,
          nota: data.nota,
          creadoPorUsuarioId: data.creadoPorUsuarioId,
          idempotencyKey: data.idempotencyKey,
          reemplazaPagoExternoId: data.reemplazaPagoExternoId,
          estadoComprobante: data.estadoComprobante,
        },
        include: { ajustes: true },
      });
      return mapearPagoExternoPrisma(pago);
    },
    async crearAjustePagoExterno(data) {
      const ajuste = await tx.ajustePagoExterno.create({
        data: {
          pagoExternoId: data.pagoExternoId,
          tipo: data.tipo,
          montoMxn: aMxn(data.montoCentavos),
          motivo: data.motivo,
          creadoPorUsuarioId: data.creadoPorUsuarioId,
          idempotencyKey: data.idempotencyKey,
        },
      });
      return mapearAjustePrisma(ajuste);
    },
  };
}

export function crearRepositorioPrismaPagosExternos(
  cliente: typeof prisma
): RepositorioPagosExternos {
  return {
    async cargarActor(usuarioPropiedadId, propiedadId) {
      const actor = await cliente.usuarioPropiedad.findFirst({
        where: { id: usuarioPropiedadId, propiedadId },
        select: { id: true, propiedadId: true, rol: true },
      });
      return actor
        ? {
            usuarioPropiedadId: actor.id,
            propiedadId: actor.propiedadId,
            rol: actor.rol,
          }
        : null;
    },
    transaccion(trabajo) {
      return cliente.$transaction((tx) => trabajo(crearTransaccionPrisma(tx)));
    },
    leerLedgerReserva(propiedadId, reservaId) {
      return cargarLedgerPrisma(cliente, propiedadId, reservaId);
    },
    async leerDatosComprobante(propiedadId, reservaId, pagoExternoId) {
      const [ledger, reserva] = await Promise.all([
        cargarLedgerPrisma(cliente, propiedadId, reservaId),
        cliente.reserva.findFirst({
          where: { id: reservaId, propiedadId },
          select: {
            codigoReserva: true,
            fechaIngreso: true,
            fechaSalida: true,
            numPersonas: true,
            huesped: { select: { email: true, nombre: true } },
            tipoDeHabitacion: { select: { nombre: true } },
            propiedad: { select: { nombre: true, colorPrimario: true } },
          },
        }),
      ]);
      const pago = ledger?.pagosExternos.find((item) => item.id === pagoExternoId);
      if (!ledger || !reserva || !pago) return null;
      return {
        pago,
        ledger,
        destinatario: {
          emailHuesped: reserva.huesped.email,
          codigoReserva: reserva.codigoReserva,
          nombreHuesped: reserva.huesped.nombre,
          nombreHotel: reserva.propiedad.nombre,
          tipoHabitacion: reserva.tipoDeHabitacion.nombre,
          fechaIngreso: reserva.fechaIngreso,
          fechaSalida: reserva.fechaSalida,
          numPersonas: reserva.numPersonas,
          colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
        },
      };
    },
    async actualizarEstadoComprobante(pagoExternoId, data) {
      const pago = await cliente.pagoExterno.update({
        where: { id: pagoExternoId },
        data,
        include: { ajustes: true },
      });
      return mapearPagoExternoPrisma(pago);
    },
  };
}

const repositorioPrisma = crearRepositorioPrismaPagosExternos(prisma);

const servicioPagosExternos = crearServicioPagosExternos(repositorioPrisma, {
  ledgerHabilitado: () => process.env.PAGOS_EXTERNOS_LEDGER_ENABLED === "true",
  enviarComprobante: enviarComprobantePago,
  registrarErrorComprobante: ({ pagoExternoId, nombreError }) => {
    console.error("[pagos-externos] Falló el comprobante", {
      pagoExternoId,
      nombreError,
    });
  },
});

export const obtenerLedgerReserva = servicioPagosExternos.obtenerLedgerReserva;
export const registrarPagoExterno = servicioPagosExternos.registrarPagoExterno;
export const reenviarComprobantePagoExterno = servicioPagosExternos.reenviarComprobantePagoExterno;
export const corregirPagoExterno = servicioPagosExternos.corregirPagoExterno;
export const ajustarPagoExterno = servicioPagosExternos.ajustarPagoExterno;
