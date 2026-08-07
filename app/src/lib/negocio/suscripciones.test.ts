import { describe, expect, it } from "vitest";
import { puedeAdministrarSuscripcion, tieneAccesoRoomly } from "./suscripciones";

describe("tieneAccesoRoomly", () => {
  it("mantiene acceso para una propiedad existente con acceso gratuito heredado", () => {
    expect(tieneAccesoRoomly({ suscripcionActiva: false, accesoGratisLegacy: true })).toBe(true);
  });

  it("permite acceso a una propiedad nueva con suscripción activa", () => {
    expect(tieneAccesoRoomly({ suscripcionActiva: true, accesoGratisLegacy: false })).toBe(true);
  });

  it("bloquea una propiedad nueva que no completó su suscripción", () => {
    expect(tieneAccesoRoomly({ suscripcionActiva: false, accesoGratisLegacy: false })).toBe(false);
  });
});

describe("puedeAdministrarSuscripcion", () => {
  it("impide que una cuenta gratuita heredada active cambios de facturación", () => {
    expect(puedeAdministrarSuscripcion({ accesoGratisLegacy: true })).toBe(false);
  });
});
