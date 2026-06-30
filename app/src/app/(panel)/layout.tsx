import { redirect } from "next/navigation";
import { getCurrentUsuario } from "@/lib/auth";
import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { SuccessToast } from "@/components/SuccessToast";
import { ClerkProvider } from "@clerk/nextjs";

// Rutas restringidas por rol:
// - Configuración y tipos/habitaciones/temporadas: solo ADMIN y SUPER_ADMIN
// - Reportes/Finanzas: ADMIN, FINANZAS, SUPER_ADMIN
// - Todo lo demás: cualquier rol autenticado
const RUTAS_ADMIN = ["/panel/configuracion", "/panel/tipos", "/panel/habitaciones", "/panel/temporadas", "/panel/bloqueos"];
const RUTAS_FINANZAS = ["/panel/reportes"];

const ROLES_ADMIN: RolUsuario[] = [RolUsuario.ADMIN, RolUsuario.SUPER_ADMIN];
const ROLES_FINANZAS: RolUsuario[] = [RolUsuario.ADMIN, RolUsuario.FINANZAS, RolUsuario.SUPER_ADMIN];

const NAV = [
  { href: "/panel", label: "Dashboard", roles: null },
  { href: "/panel/calendario", label: "Calendario", roles: null },
  { href: "/panel/reservas", label: "Reservas", roles: null },
  { href: "/panel/tipos", label: "Tipos de habitación", roles: ROLES_ADMIN },
  { href: "/panel/habitaciones", label: "Habitaciones", roles: ROLES_ADMIN },
  { href: "/panel/temporadas", label: "Temporadas", roles: ROLES_ADMIN },
  { href: "/panel/bloqueos", label: "Bloqueos", roles: ROLES_ADMIN },
  { href: "/panel/reportes", label: "Reportes", roles: ROLES_FINANZAS },
  { href: "/panel/configuracion", label: "Configuración", roles: ROLES_ADMIN },
];

const ROL_LABEL: Record<RolUsuario, string> = {
  ADMIN: "Admin",
  RESERVACIONES: "Reservaciones",
  FINANZAS: "Finanzas",
  SUPER_ADMIN: "Super Admin",
};

export default async function PanelLayout({
  children,
  // pathname no está disponible en layouts — la protección por ruta
  // se hace a nivel de cada page o con middleware (proxy.ts)
}: {
  children: React.ReactNode;
}) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const rol = usuario.rol;

  const navVisible = NAV.filter(
    (item) => item.roles === null || item.roles.includes(rol)
  );

  return (
    <ClerkProvider>
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-200">
          <div className="text-sm font-semibold text-gray-900 truncate">{usuario.propiedad.nombre}</div>
          <div className="text-xs text-gray-400 mt-0.5">{ROL_LABEL[rol]}</div>
        </div>
        <nav className="flex-1 py-4">
          {navVisible.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <RolGuard rol={rol} rutasAdmin={RUTAS_ADMIN} rutasFinanzas={RUTAS_FINANZAS}>
          {children}
        </RolGuard>
      </main>
      <SuccessToast />
    </div>
    </ClerkProvider>
  );
}

// Componente server que verifica acceso a rutas protegidas.
// Como no tenemos pathname en el layout, delegamos la verificación
// a un helper que cada page puede llamar directamente vía requireRole().
// Este componente solo renderiza los children — la protección real
// ocurre en cada page con getCurrentUsuario() + verificación de rol.
function RolGuard({
  children,
}: {
  rol: RolUsuario;
  rutasAdmin: string[];
  rutasFinanzas: string[];
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
