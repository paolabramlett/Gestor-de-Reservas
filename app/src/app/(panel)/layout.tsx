import { redirect } from "next/navigation";
import { getCurrentUsuario } from "@/lib/auth";
import { RolUsuario } from "@prisma/client";
import { SuccessToast } from "@/components/SuccessToast";
import { ClerkProvider } from "@clerk/nextjs";
import { Sidebar } from "./Sidebar";

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
  { href: "/panel/grupos", label: "Reservas grupales", roles: null },
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
  if (!usuario) {
    // Usuario autenticado en Clerk pero sin hotel configurado → setup
    const { userId } = await (await import("@clerk/nextjs/server")).auth();
    if (userId) redirect("/setup");
    redirect("/sign-in");
  }

  // Suscripción cancelada → bloquear acceso al panel
  if (!usuario.propiedad.suscripcionActiva) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">
            Tu suscripción está inactiva
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            El acceso a {usuario.propiedad.nombre} está pausado. Tus datos y reservas
            están guardados de forma segura — reactiva tu plan para continuar.
          </p>
          <a
            href="mailto:contacto.roomly@gmail.com?subject=Reactivar%20suscripci%C3%B3n%20Roomly"
            className="inline-flex rounded-lg bg-gray-900 text-white px-5 py-2.5 text-sm font-semibold hover:bg-gray-700"
          >
            Reactivar mi suscripción
          </a>
        </div>
      </div>
    );
  }

  const rol = usuario.rol;

  const navVisible = NAV.filter(
    (item) => item.roles === null || item.roles.includes(rol)
  );

  return (
    <ClerkProvider>
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar
        nombre={usuario.propiedad.nombre}
        rolLabel={ROL_LABEL[rol]}
        nav={navVisible}
      />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
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
