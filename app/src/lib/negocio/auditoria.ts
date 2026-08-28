import { prisma } from "@/lib/prisma";
import { RolUsuario, Prisma } from "@prisma/client";

export type AuditoriaOperacionInput = {
  propiedadId: string;
  actorUsuarioId?: string | null;
  reservaId?: string | null;
  grupoId?: string | null;
  accion: string;
  resultado: "EXITO" | "ERROR";
  rol?: RolUsuario | null;
  importeAnteriorMxn?: number | null;
  importeNuevoMxn?: number | null;
  motivo?: string | null;
  idempotencyKey?: string | null;
  stripeId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

/** Registra una mutación sin reemplazar la autorización de la acción. */
export async function registrarAuditoriaOperacion(input: AuditoriaOperacionInput) {
  return prisma.auditoriaOperacion.create({
    data: {
      propiedadId: input.propiedadId,
      actorUsuarioId: input.actorUsuarioId ?? null,
      reservaId: input.reservaId ?? null,
      grupoId: input.grupoId ?? null,
      accion: input.accion,
      resultado: input.resultado,
      rol: input.rol ?? null,
      importeAnteriorMxn: input.importeAnteriorMxn ?? null,
      importeNuevoMxn: input.importeNuevoMxn ?? null,
      motivo: input.motivo ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      stripeId: input.stripeId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}
