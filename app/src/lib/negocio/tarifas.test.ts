import { describe, it, expect } from "vitest";
import { calcularPrecioNoche, type DesglosePorNoche } from "./tarifas";

function noche(
  modalidad: DesglosePorNoche["modalidad"],
  precio: number,
  suplementoPorPersona?: number
): Pick<DesglosePorNoche, "precio" | "modalidad" | "suplementoPorPersona"> {
  return { modalidad, precio, suplementoPorPersona };
}

describe("calcularPrecioNoche — POR_HABITACION", () => {
  it("cobra el mismo precio sin importar el número de personas", () => {
    const tarifa = noche("POR_HABITACION", 1200);
    expect(calcularPrecioNoche(tarifa, 1)).toBe(1200);
    expect(calcularPrecioNoche(tarifa, 4)).toBe(1200);
  });
});

describe("calcularPrecioNoche — POR_PERSONA", () => {
  it("multiplica el precio por el número de personas", () => {
    const tarifa = noche("POR_PERSONA", 500);
    expect(calcularPrecioNoche(tarifa, 1)).toBe(500);
    expect(calcularPrecioNoche(tarifa, 2)).toBe(1000);
    expect(calcularPrecioNoche(tarifa, 4)).toBe(2000);
  });
});

describe("calcularPrecioNoche — BASE_MAS_SUPLEMENTO", () => {
  it("la primera persona paga la base; cada extra suma el suplemento", () => {
    const tarifa = noche("BASE_MAS_SUPLEMENTO", 1000, 200);
    expect(calcularPrecioNoche(tarifa, 1)).toBe(1000);
    expect(calcularPrecioNoche(tarifa, 2)).toBe(1200);
    expect(calcularPrecioNoche(tarifa, 4)).toBe(1600);
  });

  it("reproduce el caso real de Habitación Doble (base 1000, suplemento 199.98)", () => {
    const tarifa = noche("BASE_MAS_SUPLEMENTO", 1000, 199.98);
    // 1000 + 3 × 199.98 = 1599.94
    expect(calcularPrecioNoche(tarifa, 4)).toBeCloseTo(1599.94, 2);
  });

  it("sin suplemento definido, se comporta como precio fijo", () => {
    const tarifa = noche("BASE_MAS_SUPLEMENTO", 1500, undefined);
    expect(calcularPrecioNoche(tarifa, 3)).toBe(1500);
  });
});

describe("calcularPrecioNoche — casos límite", () => {
  it("trata 0 o números negativos de personas como 1 (nunca resta de más)", () => {
    const porPersona = noche("POR_PERSONA", 500);
    expect(calcularPrecioNoche(porPersona, 0)).toBe(500);
    expect(calcularPrecioNoche(porPersona, -3)).toBe(500);

    const baseMas = noche("BASE_MAS_SUPLEMENTO", 1000, 200);
    expect(calcularPrecioNoche(baseMas, 0)).toBe(1000);
  });
});

describe("total por varias noches (suma del desglose)", () => {
  // Simula lo que hace calcularTotalReserva: sumar el precio de cada noche.
  function totalVariasNoches(
    tarifa: Pick<DesglosePorNoche, "precio" | "modalidad" | "suplementoPorPersona">,
    numPersonas: number,
    noches: number
  ): number {
    let total = 0;
    for (let i = 0; i < noches; i++) total += calcularPrecioNoche(tarifa, numPersonas);
    return total;
  }

  it("escala linealmente con el número de noches", () => {
    const tarifa = noche("BASE_MAS_SUPLEMENTO", 1000, 199.98);
    expect(totalVariasNoches(tarifa, 4, 1)).toBeCloseTo(1599.94, 2);
    expect(totalVariasNoches(tarifa, 4, 2)).toBeCloseTo(3199.88, 2);
    expect(totalVariasNoches(tarifa, 4, 3)).toBeCloseTo(4799.82, 2);
  });

  it("Suite Deluxe: base 1600, suplemento 400, 2 personas, 1 noche = 2000", () => {
    const tarifa = noche("BASE_MAS_SUPLEMENTO", 1600, 400);
    expect(totalVariasNoches(tarifa, 2, 1)).toBe(2000);
  });
});
