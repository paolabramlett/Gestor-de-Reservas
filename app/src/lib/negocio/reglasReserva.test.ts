import { describe, expect, it } from "vitest";
import {
  estadoSegunMontoRecibido,
  resolverTotalReserva,
  resolverMontoCobro,
  rutaReservaDespuesDeGuardarNotas,
  validarPagoManual,
} from "./reglasReserva";

describe("retroalimentación al guardar notas", () => {
  it("regresa al detalle con una confirmación visible", () => {
    expect(rutaReservaDespuesDeGuardarNotas("reserva-123"))
      .toBe("/panel/reservas/reserva-123?notas=guardadas");
  });
});

describe("reglas de precio de una reserva", () => {
  it("ignora un total sobrescrito cuando la reserva es normal", () => {
    expect(resolverTotalReserva(3200, null, 100)).toBe(3200);
  });

  it("una cortesía siempre cuesta cero", () => {
    expect(resolverTotalReserva(3200, "CORTESIA", 100)).toBe(0);
  });

  it("un precio acordado requiere un total válido", () => {
    expect(() => resolverTotalReserva(3200, "PRECIO_ACORDADO", null)).toThrow("PRECIO_ESPECIAL_INVALIDO");
  });
});

describe("reglas de pago", () => {
  it("el pago completo usa el total calculado y no el monto enviado por el cliente", () => {
    expect(resolverMontoCobro(3200, true, 1)).toBe(3200);
  });

  it("rechaza anticipos iguales o mayores al total", () => {
    expect(() => resolverMontoCobro(3200, false, 3200)).toThrow("ANTICIPO_INVALIDO");
  });

  it("una cortesía no puede registrar pagos", () => {
    expect(() => validarPagoManual(0, "PAGADO_COMPLETO", null)).toThrow("CORTESIA_NO_ADMITE_PAGO");
  });

  it("el estado final depende del monto recibido, no de una bandera", () => {
    expect(estadoSegunMontoRecibido(3200, 500)).toBe("ANTICIPO_PAGADO");
    expect(estadoSegunMontoRecibido(3200, 3200)).toBe("PAGADO_COMPLETO");
  });
});
