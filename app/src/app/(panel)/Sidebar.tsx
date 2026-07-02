"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export function Sidebar({
  nombre,
  rolLabel,
  nav,
}: {
  nombre: string;
  rolLabel: string;
  nav: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Cierra el menú al navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  // Cierra con Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const sidebarContent = (
    <>
      <div className="px-4 py-5 border-b border-gray-200">
        <div className="text-sm font-semibold text-gray-900 truncate">{nombre}</div>
        <div className="text-xs text-gray-400 mt-0.5">{rolLabel}</div>
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
              <div>
                <div className="text-sm font-semibold text-gray-900 truncate">{nombre}</div>
                <div className="text-xs text-gray-400 mt-0.5">{rolLabel}</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
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
          </aside>
        </div>
      )}
    </>
  );
}
