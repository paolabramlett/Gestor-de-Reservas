"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export function CerrarSesionBoton({ redirectUrl }: { redirectUrl: string }) {
  const { signOut } = useClerk();
  const router = useRouter();

  async function handleClick() {
    await signOut();
    router.push(redirectUrl);
  }

  return (
    <button
      onClick={handleClick}
      className="text-sm text-gray-600 hover:text-gray-900 underline"
    >
      Cerrar sesión y usar otra cuenta
    </button>
  );
}
