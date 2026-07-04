import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { CerrarSesionBoton } from "./CerrarSesionBoton";

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  RESERVACIONES: "Reservaciones",
  FINANZAS: "Finanzas",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image src="/roomly-logo.png" alt="Roomly" width={140} height={36} priority style={{ objectFit: "contain" }} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">{children}</div>
      </div>
    </div>
  );
}

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitacion = await prisma.invitacionEquipo.findUnique({
    where: { token },
    include: { propiedad: true },
  });

  if (!invitacion) {
    return (
      <Card>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Invitación no encontrada</h1>
        <p className="text-sm text-gray-500">Este link de invitación no es válido. Pide al administrador del hotel que te envíe una nueva.</p>
      </Card>
    );
  }

  if (invitacion.canceladaEn) {
    return (
      <Card>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Invitación cancelada</h1>
        <p className="text-sm text-gray-500">Esta invitación ya no está disponible. Pide al administrador de {invitacion.propiedad.nombre} que te envíe una nueva.</p>
      </Card>
    );
  }

  if (invitacion.expiraEn < new Date() && !invitacion.aceptadaEn) {
    return (
      <Card>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Invitación expirada</h1>
        <p className="text-sm text-gray-500">Esta invitación venció. Pide al administrador de {invitacion.propiedad.nombre} que te envíe una nueva.</p>
      </Card>
    );
  }

  const { userId } = await auth();

  if (!userId) {
    return (
      <Card>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">
          Te invitaron a {invitacion.propiedad.nombre}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Rol: <strong>{ROL_LABEL[invitacion.rol] ?? invitacion.rol}</strong>. Inicia sesión o crea una cuenta con el correo{" "}
          <strong>{invitacion.email}</strong> para continuar.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={`/sign-up?redirect_url=${encodeURIComponent(`/invitacion/${token}`)}`}
            className="w-full rounded-lg bg-gray-900 text-white py-2.5 text-sm font-semibold hover:bg-gray-700"
          >
            Crear cuenta
          </Link>
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(`/invitacion/${token}`)}`}
            className="w-full rounded-lg border border-gray-300 text-gray-700 py-2.5 text-sm font-semibold hover:bg-gray-50"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </Card>
    );
  }

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const emailInvitacion = invitacion.email.toLowerCase();
  const coincide = clerkUser.emailAddresses.some((e) => e.emailAddress.toLowerCase() === emailInvitacion);

  if (!coincide) {
    return (
      <Card>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Correo distinto</h1>
        <p className="text-sm text-gray-500 mb-6">
          Esta invitación es para <strong>{invitacion.email}</strong>, pero tu cuenta usa un correo distinto. Cierra sesión e inicia con la cuenta correcta, o pide una nueva invitación a ese correo.
        </p>
        <CerrarSesionBoton redirectUrl={`/sign-in?redirect_url=${encodeURIComponent(`/invitacion/${token}`)}`} />
      </Card>
    );
  }

  // Ya es miembro de este hotel (invitación reenviada o aceptada dos veces) → solo pasa al panel
  const yaEsMiembro = await prisma.usuarioPropiedad.findFirst({
    where: { clerkUserId: userId, propiedadId: invitacion.propiedadId },
  });

  if (!yaEsMiembro) {
    await prisma.usuarioPropiedad.create({
      data: { clerkUserId: userId, propiedadId: invitacion.propiedadId, rol: invitacion.rol },
    });
  }

  if (!invitacion.aceptadaEn) {
    await prisma.invitacionEquipo.update({
      where: { id: invitacion.id },
      data: { aceptadaEn: new Date() },
    });
  }

  redirect("/panel?bienvenida=1");
}
