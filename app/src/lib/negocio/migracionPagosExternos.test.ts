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

  it("no migra un pendiente sin importe aunque Stripe sea inconsistente", () => {
    expect(clasificarPagoManualLegacy({
      estado: "PENDIENTE",
      montoAnticipoCentavos: null,
      totalCentavos: 600_000,
      stripeNetoCentavos: -1,
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

  it("migra un completo legacy con el saldo explícito que no cubrió Stripe", () => {
    expect(clasificarPagoManualLegacy({
      estado: "PAGADO_COMPLETO",
      montoAnticipoCentavos: 300_000,
      totalCentavos: 600_000,
      stripeNetoCentavos: 300_000,
    })).toEqual({
      montoCentavos: 300_000,
      nota: "",
      requiereRevision: false,
      motivoRevision: null,
    });
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

  it("marca para revisión un anticipo con neto Stripe negativo", () => {
    expect(clasificarPagoManualLegacy({
      estado: "ANTICIPO_PAGADO",
      montoAnticipoCentavos: 200_000,
      totalCentavos: 600_000,
      stripeNetoCentavos: -1,
    })).toMatchObject({
      montoCentavos: 200_000,
      requiereRevision: true,
      motivoRevision: "STRIPE_NETO_NEGATIVO",
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

  it("prioriza la revisión del contexto Stripe negativo en un pendiente", () => {
    expect(clasificarPagoManualLegacy({
      estado: "PENDIENTE",
      montoAnticipoCentavos: 200_000,
      totalCentavos: 600_000,
      stripeNetoCentavos: -1,
    })).toMatchObject({
      montoCentavos: 200_000,
      requiereRevision: true,
      motivoRevision: "STRIPE_NETO_NEGATIVO",
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
      motivoRevision: "SALDO_EXTERNO_NEGATIVO",
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

  it("no migra un anticipo sin importe explícito", () => {
    expect(clasificarPagoManualLegacy({
      estado: "ANTICIPO_PAGADO",
      montoAnticipoCentavos: null,
      totalCentavos: 600_000,
      stripeNetoCentavos: 0,
    })).toBeNull();
  });

  it("no migra un anticipo sin importe aunque Stripe sea inconsistente", () => {
    expect(clasificarPagoManualLegacy({
      estado: "ANTICIPO_PAGADO",
      montoAnticipoCentavos: null,
      totalCentavos: 600_000,
      stripeNetoCentavos: -1,
    })).toBeNull();
  });

  it("marca para revisión un completo con importe explícito que no coincide con el saldo", () => {
    expect(clasificarPagoManualLegacy({
      estado: "PAGADO_COMPLETO",
      montoAnticipoCentavos: 200_000,
      totalCentavos: 600_000,
      stripeNetoCentavos: 300_000,
    })).toMatchObject({
      montoCentavos: 200_000,
      requiereRevision: true,
      motivoRevision: "MONTO_NO_COINCIDE_SALDO",
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
