"use client";

import { useEffect, useState } from "react";

// Los navegadores integrados de apps como Gmail, Instagram o Facebook
// restringen cookies/almacenamiento y suelen romper flujos con varios
// redirects (login, aceptar invitación, checkout). Detectamos los más
// comunes por user agent y sugerimos abrir el link en el navegador real.
function esNavegadorEmbebido(ua: string): boolean {
  return /GSA\/|FBAN|FBAV|Instagram|Line\/|MicroMessenger|Twitter|LinkedInApp/i.test(ua);
}

export function AbrirEnNavegadorBanner() {
  const [mostrar, setMostrar] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (esNavegadorEmbebido(navigator.userAgent)) setMostrar(true);
  }, []);

  if (!mostrar) return null;

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin acceso al clipboard — el usuario puede copiar la URL manualmente
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-800 flex items-center justify-between gap-3 flex-wrap">
      <span>
        Estás usando el navegador integrado de una app. Para evitar errores al iniciar sesión, abre este link en Safari o Chrome.
      </span>
      <button
        onClick={copiarLink}
        className="shrink-0 rounded-lg bg-amber-800 text-white px-3 py-1 font-medium hover:bg-amber-900"
      >
        {copiado ? "¡Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}
