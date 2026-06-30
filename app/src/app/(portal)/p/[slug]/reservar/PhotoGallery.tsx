"use client";

import { useState } from "react";

export default function PhotoGallery({ fotos, alt }: { fotos: string[]; alt: string }) {
  const [activo, setActivo] = useState(0);

  if (fotos.length === 0) {
    return (
      <div className="w-full h-44 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <div className="relative w-full h-44 bg-gray-100">
        <img src={fotos[activo]} alt={alt} className="w-full h-full object-cover" />
        {fotos.length > 1 && (
          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full">
            {activo + 1}/{fotos.length}
          </span>
        )}
      </div>
      {fotos.length > 1 && (
        <div className="flex gap-1.5 p-2 overflow-x-auto bg-white">
          {fotos.map((foto, i) => (
            <button
              key={foto}
              type="button"
              onClick={() => setActivo(i)}
              className={`shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-colors ${
                i === activo ? "border-gray-900" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={foto} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
