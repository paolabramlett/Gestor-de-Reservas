import { describe, expect, it } from "vitest";
import { RolUsuario } from "@prisma/client";
import {
  crearServicioPagosExternos,
  type AjustePagoExternoLedger,
  type DatosLedgerReserva,
  type NuevoAjustePagoExterno,
  type NuevoPagoExterno,
  type PagoExternoLedger,
  type RepositorioPagosExternos,
  type TransaccionPagosExternos,
} from "./pagosExternos.server";

const actorFinanzas = {
  usuarioPropiedadId: "usr_fin",
  propiedadId: "prop_1",
  rol: RolUsuario.FINANZAS,
};

const actorAdmin = {
  usuarioPropiedadId: "usr_admin",
  propiedadId: "prop_1",
  rol: RolUsuario.ADMIN,
};

const input = {
  reservaId: "res_1",
  montoCentavos: 300_000,
  metodo: "TRANSFERENCIA" as const,
  fechaPago: new Date("2026-08-14T16:00:00Z"),
  enviarComprobante: true,
  idempotencyKey: "idem_1",
};

class RepositorioEnMemoria implements RepositorioPagosExternos, TransaccionPagosExternos {
  readonly creados: PagoExternoLedger[] = [];
  readonly ajustes: AjustePagoExternoLedger[] = [];
  readonly eventos: string[] = [];
  transacciones = 0;
  fallarSiguientePago = false;

  constructor(private readonly ledger: DatosLedgerReserva) {}

  async transaccion<T>(trabajo: (tx: TransaccionPagosExternos) => Promise<T>): Promise<T> {
    this.transacciones++;
    const pagosAntes = this.creados.length;
    const ajustesAntes = this.ajustes.length;
    try {
      return await trabajo(this);
    } catch (error) {
      this.creados.splice(pagosAntes);
      this.ajustes.splice(ajustesAntes);
      throw error;
    }
  }

  async cargarActor(usuarioPropiedadId: string, propiedadId: string) {
    const membresias = new Map([
      ["usr_fin:prop_1", RolUsuario.FINANZAS],
      ["usr_admin:prop_1", RolUsuario.ADMIN],
      ["usr_res:prop_1", RolUsuario.RESERVACIONES],
      ["usr_super:prop_1", RolUsuario.SUPER_ADMIN],
      ["usr_otro:prop_2", RolUsuario.ADMIN],
    ]);
    const rol = membresias.get(`${usuarioPropiedadId}:${propiedadId}`) ?? null;
    return rol ? { usuarioPropiedadId, propiedadId, rol } : null;
  }

  async adquirirLockReserva(reservaId: string): Promise<void> {
    this.eventos.push(`lock:${reservaId}`);
  }

  async adquirirLockIdempotencia(idempotencyKey: string): Promise<void> {
    this.eventos.push(`lock-idempotencia:${idempotencyKey}`);
  }

  async buscarResultadoIdempotencia(idempotencyKey: string) {
    this.eventos.push("idempotencia:unificada");
    const pagos = [...this.ledger.pagosExternos, ...this.creados];
    const pago = pagos.find((item) => item.idempotencyKey === idempotencyKey) ?? null;
    const ajusteBase = this.ajustes.find(
      (item) => item.idempotencyKey === idempotencyKey
    ) ?? null;
    const pagoAjustado = ajusteBase
      ? pagos.find((item) => item.id === ajusteBase.pagoExternoId)
      : null;
    return {
      pago,
      ajuste: ajusteBase && pagoAjustado
        ? {
            ...ajusteBase,
            propiedadId: pagoAjustado.propiedadId,
            reservaId: pagoAjustado.reservaId,
          }
        : null,
    };
  }

  async cargarLedgerReserva(propiedadId: string, reservaId: string) {
    this.eventos.push("cargar:ledger");
    if (
      this.ledger.reserva.propiedadId !== propiedadId ||
      this.ledger.reserva.id !== reservaId
    ) {
      return null;
    }
    const ajustesCreados = this.ajustes;
    return {
      ...this.ledger,
      pagosExternos: [...this.ledger.pagosExternos, ...this.creados].map((pago) => ({
        ...pago,
        ajustes: [
          ...pago.ajustes,
          ...ajustesCreados.filter((ajuste) => ajuste.pagoExternoId === pago.id),
        ],
      })),
    };
  }

  async crearPagoExterno(data: NuevoPagoExterno): Promise<PagoExternoLedger> {
    this.eventos.push("insertar:pago");
    if (this.fallarSiguientePago) {
      this.fallarSiguientePago = false;
      throw new Error("FALLO_INSERTAR_REEMPLAZO");
    }
    const pago: PagoExternoLedger = {
      ...data,
      id: `ext_nuevo_${this.creados.length + 1}`,
      ajustes: [],
      creadoEn: new Date("2026-08-14T18:00:00Z"),
    };
    this.creados.push(pago);
    return pago;
  }

  async crearAjustePagoExterno(data: NuevoAjustePagoExterno) {
    this.eventos.push("insertar:ajuste");
    const ajuste = {
      ...data,
      id: `ajuste_${this.ajustes.length + 1}`,
      creadoEn: new Date("2026-08-14T18:00:00Z"),
    };
    this.ajustes.push(ajuste);
    return ajuste;
  }

  async leerLedgerReserva(propiedadId: string, reservaId: string) {
    return this.cargarLedgerReserva(propiedadId, reservaId);
  }
}

function escenarioServicio({
  saldoCentavos,
  estado = "CONFIRMADA",
  pagoExternoCentavos = 0,
  ajustesCentavos = 0,
}: {
  saldoCentavos: number;
  estado?: DatosLedgerReserva["reserva"]["estado"];
  pagoExternoCentavos?: number;
  ajustesCentavos?: number;
}) {
  const totalReservaCentavos = 600_000;
  const externoNetoCentavos = pagoExternoCentavos - ajustesCentavos;
  const stripeNetoCentavos = totalReservaCentavos - saldoCentavos - externoNetoCentavos;
  const pagoExterno: PagoExternoLedger | null = pagoExternoCentavos > 0
    ? {
        id: "ext_1",
        propiedadId: "prop_1",
        reservaId: "res_1",
        montoCentavos: pagoExternoCentavos,
        metodo: "TRANSFERENCIA",
        fechaPago: new Date("2026-08-14T14:00:00Z"),
        nota: null,
        creadoPorUsuarioId: "usr_admin",
        idempotencyKey: "idem_original",
        reemplazaPagoExternoId: null,
        estadoComprobante: "NO_SOLICITADO",
        ajustes: ajustesCentavos > 0
          ? [{
              id: "ajuste_original",
              pagoExternoId: "ext_1",
              tipo: "REEMBOLSO",
              montoCentavos: ajustesCentavos,
              motivo: "Ajuste previo",
              creadoPorUsuarioId: "usr_admin",
              idempotencyKey: "ajuste_original",
              creadoEn: new Date("2026-08-14T14:30:00Z"),
            }]
          : [],
        creadoEn: new Date("2026-08-14T14:00:00Z"),
      }
    : null;
  const repo = new RepositorioEnMemoria({
    reserva: {
      id: "res_1",
      propiedadId: "prop_1",
      estado,
      totalReservaCentavos,
    },
    pagosStripe: stripeNetoCentavos === 0
      ? []
      : [{
          id: "stripe_1",
          cobradoCentavos: stripeNetoCentavos,
          reembolsadoCentavos: 0,
          reembolsoPendienteCentavos: 0,
          creadoEn: new Date("2026-08-14T15:00:00Z"),
        }],
    pagosExternos: pagoExterno ? [pagoExterno] : [],
  });
  return {
    repo,
    service: crearServicioPagosExternos(repo, { ledgerHabilitado: () => true }),
  };
}

describe("pagos externos", () => {
  it("rechaza Finanzas antes de escribir", async () => {
    const { service, repo } = escenarioServicio({ saldoCentavos: 300_000 });

    await expect(service.registrarPagoExterno(actorFinanzas, input)).rejects.toThrow(
      "ROL_PAGO_EXTERNO_DENEGADO"
    );
    expect(repo.transacciones).toBe(0);
  });

  it("rechaza un importe superior al saldo recalculado", async () => {
    const { service, repo } = escenarioServicio({ saldoCentavos: 299_999 });

    await expect(service.registrarPagoExterno(actorAdmin, input)).rejects.toThrow(
      "SALDO_INSUFICIENTE"
    );
    expect(repo.creados).toHaveLength(0);
  });

  it("devuelve el mismo movimiento al repetir idempotencyKey", async () => {
    const { service, repo } = escenarioServicio({ saldoCentavos: 300_000 });

    const primero = await service.registrarPagoExterno(actorAdmin, input);
    const segundo = await service.registrarPagoExterno(actorAdmin, input);

    expect(segundo.id).toBe(primero.id);
    expect(repo.creados).toHaveLength(1);
  });

  it.each(["CANCELADA", "NO_SHOW", "COMPLETADA"] as const)(
    "rechaza cargos ordinarios sobre una reserva %s",
    async (estado) => {
      const { service, repo } = escenarioServicio({ saldoCentavos: 300_000, estado });

      await expect(service.registrarPagoExterno(actorAdmin, input)).rejects.toThrow(
        "ESTADO_RESERVA_NO_ADMITE_COBRO"
      );
      expect(repo.creados).toHaveLength(0);
    }
  );

  it("una corrección anula lo disponible y crea el reemplazo", async () => {
    const { service, repo } = escenarioServicio({
      pagoExternoCentavos: 300_000,
      saldoCentavos: 300_000,
    });

    await service.corregirPagoExterno(actorAdmin, {
      reservaId: "res_1",
      pagoExternoId: "ext_1",
      nuevoMontoCentavos: 250_000,
      metodo: "EFECTIVO",
      fechaPago: new Date("2026-08-14T17:00:00Z"),
      motivo: "Importe capturado incorrectamente",
      nota: "Corrección",
      idempotencyKey: "corr_1",
    });

    expect(repo.ajustes).toContainEqual(
      expect.objectContaining({ tipo: "ANULACION", montoCentavos: 300_000 })
    );
    expect(repo.creados).toContainEqual(
      expect.objectContaining({
        montoCentavos: 250_000,
        reemplazaPagoExternoId: "ext_1",
      })
    );
  });

  it("reintenta una corrección sin duplicar su anulación ni reemplazo", async () => {
    const { service, repo } = escenarioServicio({
      pagoExternoCentavos: 300_000,
      saldoCentavos: 300_000,
    });
    const correccion = {
      reservaId: "res_1",
      pagoExternoId: "ext_1",
      nuevoMontoCentavos: 250_000,
      metodo: "EFECTIVO" as const,
      fechaPago: new Date("2026-08-14T17:00:00Z"),
      motivo: "Importe capturado incorrectamente",
      idempotencyKey: "corr_retry",
    };

    const primera = await service.corregirPagoExterno(actorAdmin, correccion);
    const segunda = await service.corregirPagoExterno(actorAdmin, correccion);

    expect(segunda.reemplazo.id).toBe(primera.reemplazo.id);
    expect(repo.ajustes).toHaveLength(1);
    expect(repo.creados).toHaveLength(1);
  });

  it("revierte la anulación si falla el reemplazo de una corrección", async () => {
    const { service, repo } = escenarioServicio({
      pagoExternoCentavos: 300_000,
      saldoCentavos: 300_000,
    });
    repo.fallarSiguientePago = true;

    await expect(
      service.corregirPagoExterno(actorAdmin, {
        reservaId: "res_1",
        pagoExternoId: "ext_1",
        nuevoMontoCentavos: 250_000,
        metodo: "EFECTIVO",
        fechaPago: new Date("2026-08-14T17:00:00Z"),
        motivo: "Importe capturado incorrectamente",
        idempotencyKey: "corr_atomica",
      })
    ).rejects.toThrow("FALLO_INSERTAR_REEMPLAZO");
    expect(repo.ajustes).toHaveLength(0);
    expect(repo.creados).toHaveLength(0);
  });

  it("un reembolso parcial no puede superar el disponible externo", async () => {
    const { service, repo } = escenarioServicio({
      saldoCentavos: 520_000,
      pagoExternoCentavos: 100_000,
      ajustesCentavos: 20_000,
    });

    await expect(
      service.ajustarPagoExterno(actorAdmin, {
        reservaId: "res_1",
        pagoExternoId: "ext_1",
        tipo: "REEMBOLSO",
        montoCentavos: 80_001,
        motivo: "Devolución",
        idempotencyKey: "refund_1",
      })
    ).rejects.toThrow("AJUSTE_SUPERA_DISPONIBLE");
    expect(repo.ajustes).toHaveLength(0);
  });

  it("mantiene las lecturas disponibles con el feature flag apagado", async () => {
    const { repo } = escenarioServicio({ saldoCentavos: 300_000 });
    const service = crearServicioPagosExternos(repo, { ledgerHabilitado: () => false });

    const ledger = await service.obtenerLedgerReserva(actorAdmin, "res_1");

    expect(ledger.resumen.saldoPendienteCentavos).toBe(300_000);
    await expect(service.registrarPagoExterno(actorAdmin, input)).rejects.toThrow(
      "PAGOS_EXTERNOS_DESHABILITADOS"
    );
    expect(repo.transacciones).toBe(0);
  });

  it("ignora un rol de cliente falsificado y usa la membresía autoritativa", async () => {
    const { service, repo } = escenarioServicio({ saldoCentavos: 300_000 });
    const actorFalsificado = { ...actorFinanzas, rol: RolUsuario.ADMIN };

    await expect(
      service.registrarPagoExterno(actorFalsificado, input)
    ).rejects.toThrow("ROL_PAGO_EXTERNO_DENEGADO");
    expect(repo.transacciones).toBe(0);
  });

  it.each([
    ["usr_admin", RolUsuario.ADMIN],
    ["usr_res", RolUsuario.RESERVACIONES],
    ["usr_super", RolUsuario.SUPER_ADMIN],
  ])("permite registrar a %s con un rol autorizado", async (usuarioPropiedadId, rol) => {
    const { service, repo } = escenarioServicio({ saldoCentavos: 300_000 });

    await service.registrarPagoExterno(
      { usuarioPropiedadId, propiedadId: "prop_1", rol },
      { ...input, idempotencyKey: `idem_${usuarioPropiedadId}` }
    );

    expect(repo.creados).toHaveLength(1);
  });

  it("aísla la reserva y el idempotencyKey por Propiedad", async () => {
    const { service, repo } = escenarioServicio({ saldoCentavos: 300_000 });
    const actorOtraPropiedad = {
      usuarioPropiedadId: "usr_otro",
      propiedadId: "prop_2",
      rol: RolUsuario.ADMIN,
    };

    await expect(
      service.registrarPagoExterno(actorOtraPropiedad, input)
    ).rejects.toThrow("RESERVA_NO_ENCONTRADA");
    expect(repo.creados).toHaveLength(0);
  });

  it("mantiene lock → idempotencia → scoping → insert en un registro", async () => {
    const { service, repo } = escenarioServicio({ saldoCentavos: 300_000 });

    await service.registrarPagoExterno(actorAdmin, input);

    expect(repo.eventos).toEqual([
      "lock:res_1",
      "lock-idempotencia:idem_1",
      "idempotencia:unificada",
      "cargar:ledger",
      "insertar:pago",
    ]);
  });

  it.each(["ANULACION", "REEMBOLSO"] as const)(
    "requiere un motivo no vacío para %s",
    async (tipo) => {
      const { service, repo } = escenarioServicio({
        saldoCentavos: 500_000,
        pagoExternoCentavos: 100_000,
      });

      await expect(
        service.ajustarPagoExterno(actorAdmin, {
          reservaId: "res_1",
          pagoExternoId: "ext_1",
          tipo,
          montoCentavos: 100_000,
          motivo: "   ",
          idempotencyKey: `motivo_${tipo}`,
        })
      ).rejects.toThrow("MOTIVO_AJUSTE_REQUERIDO");
      expect(repo.ajustes).toHaveLength(0);
    }
  );

  it("requiere un motivo no vacío para corregir", async () => {
    const { service, repo } = escenarioServicio({
      saldoCentavos: 300_000,
      pagoExternoCentavos: 300_000,
    });

    await expect(
      service.corregirPagoExterno(actorAdmin, {
        reservaId: "res_1",
        pagoExternoId: "ext_1",
        nuevoMontoCentavos: 250_000,
        metodo: "EFECTIVO",
        fechaPago: new Date("2026-08-14T17:00:00Z"),
        motivo: "  ",
        idempotencyKey: "corr_sin_motivo",
      })
    ).rejects.toThrow("MOTIVO_AJUSTE_REQUERIDO");
    expect(repo.ajustes).toHaveLength(0);
    expect(repo.creados).toHaveLength(0);
  });

  it("reintenta un reembolso sin duplicar el ajuste", async () => {
    const { service, repo } = escenarioServicio({
      saldoCentavos: 500_000,
      pagoExternoCentavos: 100_000,
    });
    const reembolso = {
      reservaId: "res_1",
      pagoExternoId: "ext_1",
      tipo: "REEMBOLSO" as const,
      montoCentavos: 20_000,
      motivo: "Devolución",
      idempotencyKey: "refund_retry",
    };

    const primero = await service.ajustarPagoExterno(actorAdmin, reembolso);
    const segundo = await service.ajustarPagoExterno(actorAdmin, reembolso);

    expect(segundo.id).toBe(primero.id);
    expect(repo.ajustes).toHaveLength(1);
  });

  it("rechaza reutilizar en un ajuste la clave de un registro", async () => {
    const { service, repo } = escenarioServicio({ saldoCentavos: 300_000 });
    const pago = await service.registrarPagoExterno(actorAdmin, {
      ...input,
      idempotencyKey: "clave_cruzada_registro_ajuste",
    });

    await expect(
      service.ajustarPagoExterno(actorAdmin, {
        reservaId: "res_1",
        pagoExternoId: pago.id,
        tipo: "REEMBOLSO",
        montoCentavos: 10_000,
        motivo: "Devolución",
        idempotencyKey: "clave_cruzada_registro_ajuste",
      })
    ).rejects.toThrow("IDEMPOTENCIA_CONFLICTO");
    expect(repo.ajustes).toHaveLength(0);
  });

  it("inicia una corrección con locks antes de idempotencia y scoping", async () => {
    const { service, repo } = escenarioServicio({
      saldoCentavos: 300_000,
      pagoExternoCentavos: 300_000,
    });
    const correccion = {
      reservaId: "res_1",
      pagoExternoId: "ext_1",
      nuevoMontoCentavos: 250_000,
      metodo: "EFECTIVO" as const,
      fechaPago: new Date("2026-08-14T17:00:00Z"),
      motivo: "Importe incorrecto",
      idempotencyKey: "corr_secuencia",
    };

    await service.corregirPagoExterno(actorAdmin, correccion);

    expect(repo.eventos).toEqual([
      "lock:res_1",
      "lock-idempotencia:corr_secuencia",
      "idempotencia:unificada",
      "cargar:ledger",
      "insertar:ajuste",
      "insertar:pago",
    ]);
  });

  it("inicia un ajuste con locks antes de idempotencia y scoping", async () => {
    const { service, repo } = escenarioServicio({
      saldoCentavos: 500_000,
      pagoExternoCentavos: 100_000,
    });

    await service.ajustarPagoExterno(actorAdmin, {
      reservaId: "res_1",
      pagoExternoId: "ext_1",
      tipo: "REEMBOLSO",
      montoCentavos: 10_000,
      motivo: "Devolución",
      idempotencyKey: "ajuste_secuencia",
    });

    expect(repo.eventos).toEqual([
      "lock:res_1",
      "lock-idempotencia:ajuste_secuencia",
      "idempotencia:unificada",
      "cargar:ledger",
      "insertar:ajuste",
    ]);
  });

  it("verifica dentro del lock que el pago pertenece a la Reserva indicada", async () => {
    const { service, repo } = escenarioServicio({
      saldoCentavos: 500_000,
      pagoExternoCentavos: 100_000,
    });

    await expect(
      service.ajustarPagoExterno(actorAdmin, {
        reservaId: "res_otra",
        pagoExternoId: "ext_1",
        tipo: "REEMBOLSO",
        montoCentavos: 10_000,
        motivo: "No debe cruzarse",
        idempotencyKey: "ajuste_reserva_incorrecta",
      })
    ).rejects.toThrow("PAGO_EXTERNO_NO_ENCONTRADO");
    expect(repo.eventos).toEqual([
      "lock:res_otra",
      "lock-idempotencia:ajuste_reserva_incorrecta",
      "idempotencia:unificada",
      "cargar:ledger",
    ]);
    expect(repo.ajustes).toHaveLength(0);
  });

  it("rechaza reutilizar en un registro la clave de un ajuste", async () => {
    const { service, repo } = escenarioServicio({
      saldoCentavos: 500_000,
      pagoExternoCentavos: 100_000,
    });
    await service.ajustarPagoExterno(actorAdmin, {
      reservaId: "res_1",
      pagoExternoId: "ext_1",
      tipo: "REEMBOLSO",
      montoCentavos: 10_000,
      motivo: "Devolución",
      idempotencyKey: "clave_cruzada_ajuste_registro",
    });

    await expect(
      service.registrarPagoExterno(actorAdmin, {
        ...input,
        montoCentavos: 10_000,
        idempotencyKey: "clave_cruzada_ajuste_registro",
      })
    ).rejects.toThrow("IDEMPOTENCIA_CONFLICTO");
    expect(repo.creados).toHaveLength(0);
  });

  it("no confunde una corrección con un registro o ajuste que reutiliza su clave", async () => {
    const { service, repo } = escenarioServicio({
      saldoCentavos: 300_000,
      pagoExternoCentavos: 300_000,
    });
    await service.corregirPagoExterno(actorAdmin, {
      reservaId: "res_1",
      pagoExternoId: "ext_1",
      nuevoMontoCentavos: 250_000,
      metodo: "EFECTIVO",
      fechaPago: new Date("2026-08-14T17:00:00Z"),
      motivo: "Importe incorrecto",
      idempotencyKey: "clave_correccion_cruzada",
    });

    await expect(
      service.registrarPagoExterno(actorAdmin, {
        ...input,
        montoCentavos: 10_000,
        idempotencyKey: "clave_correccion_cruzada",
      })
    ).rejects.toThrow("IDEMPOTENCIA_CONFLICTO");
    await expect(
      service.ajustarPagoExterno(actorAdmin, {
        reservaId: "res_1",
        pagoExternoId: "ext_1",
        tipo: "ANULACION",
        montoCentavos: 300_000,
        motivo: "No debe reutilizarse",
        idempotencyKey: "clave_correccion_cruzada",
      })
    ).rejects.toThrow("IDEMPOTENCIA_CONFLICTO");
    expect(repo.creados).toHaveLength(1);
    expect(repo.ajustes).toHaveLength(1);
  });

  it("exige que una anulación cubra todo el monto disponible", async () => {
    const { service } = escenarioServicio({
      saldoCentavos: 520_000,
      pagoExternoCentavos: 100_000,
      ajustesCentavos: 20_000,
    });

    await expect(
      service.ajustarPagoExterno(actorAdmin, {
        reservaId: "res_1",
        pagoExternoId: "ext_1",
        tipo: "ANULACION",
        montoCentavos: 79_999,
        motivo: "Registro duplicado",
        idempotencyKey: "anulacion_parcial",
      })
    ).rejects.toThrow("AJUSTE_SUPERA_DISPONIBLE");
  });

  it("permite ajustar un pago externo aunque la Reserva esté completada", async () => {
    const { service, repo } = escenarioServicio({
      saldoCentavos: 500_000,
      pagoExternoCentavos: 100_000,
      estado: "COMPLETADA",
    });

    await service.ajustarPagoExterno(actorAdmin, {
      reservaId: "res_1",
      pagoExternoId: "ext_1",
      tipo: "REEMBOLSO",
      montoCentavos: 20_000,
      motivo: "Devolución posterior",
      idempotencyKey: "refund_completada",
    });

    expect(repo.ajustes).toContainEqual(
      expect.objectContaining({ tipo: "REEMBOLSO", montoCentavos: 20_000 })
    );
  });

  it("no permite editar manualmente un PagoOnline de Stripe", async () => {
    const { service, repo } = escenarioServicio({ saldoCentavos: 300_000 });

    await expect(
      service.ajustarPagoExterno(actorAdmin, {
        reservaId: "res_1",
        pagoExternoId: "stripe_1",
        tipo: "REEMBOLSO",
        montoCentavos: 10_000,
        motivo: "No aplica",
        idempotencyKey: "stripe_manual",
      })
    ).rejects.toThrow("PAGO_EXTERNO_NO_ENCONTRADO");
    expect(repo.ajustes).toHaveLength(0);
  });
});
