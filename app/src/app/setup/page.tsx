import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import { SetupForm } from "./SetupForm";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; cancelado?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const existente = await prisma.usuarioPropiedad.findFirst({
    where: { clerkUserId: userId },
  });
  if (existente) redirect("/panel");

  const { error, cancelado } = await searchParams;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <Image
            src="/roomly-logo.png"
            alt="Roomly"
            width={140}
            height={36}
            priority
            style={{ objectFit: "contain" }}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-1">
              Configura tu hotel
            </h1>
            <p className="text-sm text-gray-500">
              Elige tu plan y crea tu cuenta en minutos. Sin contratos, cancela cuando quieras.
            </p>
          </div>

          <SetupForm error={error} cancelado={cancelado === "1"} />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ¿Necesitas ayuda?{" "}
          <a
            href="mailto:paolabramlett@gmail.com"
            className="text-gray-600 hover:text-gray-900 underline"
          >
            Escríbenos
          </a>
        </p>
      </div>
    </div>
  );
}
