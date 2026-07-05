"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { limpiarHotelActivoAction } from "./panel/actions";

type NavItem = { href: string; label: string };
type Hotel = { id: string; nombre: string };

function HotelSwitcher({
  nombre,
  rolLabel,
  hoteles,
  hotelActivoId,
  cambiarHotelActivoAction,
}: {
  nombre: string;
  rolLabel: string;
  hoteles: Hotel[];
  hotelActivoId: string;
  cambiarHotelActivoAction: (fd: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (hoteles.length <= 1) {
    return (
      <div>
        <div className="text-sm font-semibold text-gray-900 truncate">{nombre}</div>
        <div className="text-xs text-gray-400 mt-0.5">{rolLabel}</div>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{nombre}</div>
          <div className="text-xs text-gray-400 mt-0.5">{rolLabel} · cambiar hotel</div>
        </div>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl border border-gray-200 shadow-xl z-50 py-1">
          {hoteles.map((h) => (
            <form key={h.id} action={cambiarHotelActivoAction}>
              <input type="hidden" name="propiedadId" value={h.id} />
              <button
                type="submit"
                disabled={h.id === hotelActivoId}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-gray-50 ${
                  h.id === hotelActivoId ? "text-gray-900 font-medium" : "text-gray-600"
                }`}
              >
                <span className="truncate">{h.nombre}</span>
                {h.id === hotelActivoId && <span className="text-xs text-green-600 shrink-0">✓</span>}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  nombre,
  rolLabel,
  nav,
  hoteles,
  hotelActivoId,
  cambiarHotelActivoAction,
}: {
  nombre: string;
  rolLabel: string;
  nav: NavItem[];
  hoteles: Hotel[];
  hotelActivoId: string;
  cambiarHotelActivoAction: (fd: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();

  async function handleSignOut() {
    await limpiarHotelActivoAction();
    await signOut();
    router.push("/");
  }

  // Cierra el menú al navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  // Cierra con Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const switcherProps = { nombre, rolLabel, hoteles, hotelActivoId, cambiarHotelActivoAction };

  const sidebarContent = (
    <>
      <div className="px-4 py-5 border-b border-gray-200">
        <HotelSwitcher {...switcherProps} />
      </div>
      <nav className="flex-1 py-4">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-4 py-2.5 text-sm hover:bg-gray-50 hover:text-gray-900 ${
              pathname === item.href ? "text-gray-900 font-medium bg-gray-50" : "text-gray-700"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="w-full text-left text-sm text-gray-500 hover:text-gray-900 py-1.5 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 flex items-center gap-3 px-4 h-14">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          aria-label="Abrir menú"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-900 truncate">{nombre}</span>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <aside className="relative w-64 bg-white flex flex-col h-full shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
              <div className="min-w-0 flex-1">
                <HotelSwitcher {...switcherProps} />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0 ml-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 py-4 overflow-y-auto">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-3 text-sm hover:bg-gray-50 hover:text-gray-900 ${
                    pathname === item.href ? "text-gray-900 font-medium bg-gray-50" : "text-gray-700"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="px-4 py-4 border-t border-gray-200">
              <button
                onClick={handleSignOut}
                className="w-full text-left text-sm text-gray-500 hover:text-gray-900 py-1.5 transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
