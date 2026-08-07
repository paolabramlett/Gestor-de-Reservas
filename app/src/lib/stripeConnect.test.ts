import { describe, expect, it } from "vitest";
import { calcularApplicationFeeCentavos } from "./stripeConnect";

describe("calcularApplicationFeeCentavos", () => {
  it("calcula la comisión en centavos", () => {
    expect(calcularApplicationFeeCentavos(1_000, 3)).toBe(3_000);
  });

  it.each([-1, 100, Number.NaN])("rechaza porcentajes de comisión peligrosos", (porcentaje) => {
    expect(() => calcularApplicationFeeCentavos(1_000, porcentaje)).toThrow("COMISION_PLATAFORMA_INVALIDA");
  });
});
