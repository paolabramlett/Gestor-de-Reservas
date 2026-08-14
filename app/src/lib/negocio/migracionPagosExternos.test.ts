import { describe, expect, it } from "vitest";
import { clasificarPagoManualLegacy } from "./migracionPagosExternos";

describe("clasificarPagoManualLegacy", () => {
  it("no migra un pendiente sin importe", () => {
    expect(clasificarPagoManualLegacy({
      estado: "PENDIENTE",
      montoAnticipoCentavos: null,
      totalCentavos: 600_000,
      stripeNetoCentavos: 0,
    })).toBeNull();
  });

  it("migra un completo legacy solo por el saldo no cubierto por Stripe", () => {
    expect(clasificarPagoManualLegacy({
      estado: "PAGADO_COMPLETO",
      montoAnticipoCentavos: null,
      totalCentavos: 600_000,
      stripeNetoCentavos: 300_000,
    })).toMatchObject({ montoCentavos: 300_000, requiereRevision: false });
  });

  it("migra un anticipo explícito y conserva la nota", () => {
    expect(clasificarPagoManualLegacy({
      estado: "ANTICIPO_PAGADO",
      montoAnticipoCentavos: 200_000,
      totalCentavos: 600_000,
      stripeNetoCentavos: 0,
      nota: "Transferencia recibida",
    })).toEqual({
      montoCentavos: 200_000,
      nota: "Transferencia recibida",
      requiereRevision: false,
      motivoRevision: null,
    });
  });

  it("marca para revisión un importe explícito de cero", () => {
    expect(clasificarPagoManualLegacy({
      estado: "ANTICIPO_PAGADO",
      montoAnticipoCentavos: 0,
      totalCentavos: 600_000,
      stripeNetoCentavos: 0,
    })).toEqual({
      montoCentavos: 0,
      nota: "",
      requiereRevision: true,
      motivoRevision: "MONTO_NO_POSITIVO",
    });
  });

  it("marca para revisión un anticipo que supera el total de la reserva", () => {
    expect(clasificarPagoManualLegacy({
      estado: "ANTICIPO_PAGADO",
      montoAnticipoCentavos: 600_001,
      totalCentavos: 600_000,
      stripeNetoCentavos: 0,
    })).toMatchObject({
      montoCentavos: 600_001,
      requiereRevision: true,
      motivoRevision: "MONTO_SUPERA_TOTAL",
    });
  });

  it("marca para revisión pagos combinados que superan el total", () => {
    expect(clasificarPagoManualLegacy({
      estado: "ANTICIPO_PAGADO",
      montoAnticipoCentavos: 400_000,
      totalCentavos: 600_000,
      stripeNetoCentavos: 300_000,
    })).toMatchObject({
      requiereRevision: true,
      motivoRevision: "PAGOS_SUPERAN_TOTAL",
    });
  });

  it("marca para revisión un pendiente con importe explícito", () => {
    expect(clasificarPagoManualLegacy({
      estado: "PENDIENTE",
      montoAnticipoCentavos: 200_000,
      totalCentavos: 600_000,
      stripeNetoCentavos: 0,
    })).toMatchObject({
      montoCentavos: 200_000,
      requiereRevision: true,
      motivoRevision: "ESTADO_AMBIGUO",
    });
  });

  it("no migra un completo cuando Stripe ya cubría todo el total", () => {
    expect(clasificarPagoManualLegacy({
      estado: "PAGADO_COMPLETO",
      montoAnticipoCentavos: null,
      totalCentavos: 600_000,
      stripeNetoCentavos: 600_000,
    })).toBeNull();
  });

  it("marca para revisión un completo cuyo saldo externo es negativo", () => {
    expect(clasificarPagoManualLegacy({
      estado: "PAGADO_COMPLETO",
      montoAnticipoCentavos: null,
      totalCentavos: 600_000,
      stripeNetoCentavos: 600_001,
    })).toMatchObject({
      montoCentavos: -1,
      requiereRevision: true,
      motivoRevision: "SALDO_EXTERNAL_NEGATIVO",
    });
  });

  it("marca para revisión un estado legacy desconocido con importe", () => {
    expect(clasificarPagoManualLegacy({
      estado: "CAPTURADO_A_MANO",
      montoAnticipoCentavos: 200_000,
      totalCentavos: 600_000,
      stripeNetoCentavos: 0,
    })).toMatchObject({
      montoCentavos: 200_000,
      requiereRevision: true,
      motivoRevision: "ESTADO_AMBIGUO",
    });
  });

  it("marca para revisión un anticipo sin importe explícito", () => {
    expect(clasificarPagoManualLegacy({
      estado: "ANTICIPO_PAGADO",
      montoAnticipoCentavos: null,
      totalCentavos: 600_000,
      stripeNetoCentavos: 0,
    })).toEqual({
      montoCentavos: 0,
      nota: "",
      requiereRevision: true,
      motivoRevision: "ESTADO_AMBIGUO",
    });
  });

  it("marca para revisión un neto Stripe negativo en un completo legacy", () => {
    expect(clasificarPagoManualLegacy({
      estado: "PAGADO_COMPLETO",
      montoAnticipoCentavos: null,
      totalCentavos: 600_000,
      stripeNetoCentavos: -1,
    })).toMatchObject({
      montoCentavos: 600_001,
      requiereRevision: true,
      motivoRevision: "STRIPE_NETO_NEGATIVO",
    });
  });
});
