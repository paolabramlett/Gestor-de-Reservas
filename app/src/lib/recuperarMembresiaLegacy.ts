type PropiedadLegacy = {
  id: string;
  membresiasAdmin: Array<{ id: string; clerkUserId: string }>;
};

type DependenciasRecuperacion = {
  buscarPropiedadesLegacy: (email: string) => Promise<PropiedadLegacy[]>;
  usuarioExisteEnClerk: (clerkUserId: string) => Promise<boolean>;
  transferirMembresia: (membresiaId: string, nuevoClerkUserId: string) => Promise<unknown>;
};

export async function recuperarMembresiaLegacy(
  identidad: { clerkUserId: string; emailVerificado: string | null },
  dependencias: DependenciasRecuperacion
): Promise<boolean> {
  if (!identidad.emailVerificado) return false;

  const candidatas = await dependencias.buscarPropiedadesLegacy(identidad.emailVerificado);
  if (candidatas.length !== 1) return false;

  const membresias = candidatas[0].membresiasAdmin;
  if (membresias.length !== 1) return false;

  const membresia = membresias[0];
  if (membresia.clerkUserId === identidad.clerkUserId) return true;

  if (await dependencias.usuarioExisteEnClerk(membresia.clerkUserId)) return false;

  await dependencias.transferirMembresia(membresia.id, identidad.clerkUserId);
  return true;
}
