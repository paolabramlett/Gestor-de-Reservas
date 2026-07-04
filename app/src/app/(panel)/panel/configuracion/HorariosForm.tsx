"use client";

type Props = {
  horaCheckIn: string;
  horaCheckOut: string;
  horasParaLateCheckIn: number;
  horasParaNoShow: number;
  costoLateCheckIn: number | null;
  actualizarHorariosAction: (fd: FormData) => Promise<void>;
};

export function HorariosForm({
  horaCheckIn,
  horaCheckOut,
  horasParaLateCheckIn,
  horasParaNoShow,
  costoLateCheckIn,
  actualizarHorariosAction,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Horarios y check-in tardío</h2>
      <p className="text-xs text-gray-400 mb-4">
        Roomly usa estos horarios para avisarte en el Dashboard cuando una reserva no ha hecho check-in.
      </p>

      <form action={actualizarHorariosAction} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hora de check-in</label>
            <input
              type="time"
              name="horaCheckIn"
              defaultValue={horaCheckIn}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hora de check-out</label>
            <input
              type="time"
              name="horaCheckOut"
              defaultValue={horaCheckOut}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Avisos de check-in tardío
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Horas tras la hora de check-in para sugerir "Late Check-in"
              </label>
              <input
                type="number"
                name="horasParaLateCheckIn"
                min={0}
                step={1}
                defaultValue={horasParaLateCheckIn}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Horas tras la hora de check-in para sugerir "No-Show"
              </label>
              <input
                type="number"
                name="horasParaNoShow"
                min={0}
                step={1}
                defaultValue={horasParaNoShow}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Costo sugerido de Late Check-in (MXN)
              <span className="ml-1 text-gray-400 font-normal">— opcional</span>
            </label>
            <div className="relative max-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input
                type="number"
                name="costoLateCheckIn"
                min={0}
                step="0.01"
                defaultValue={costoLateCheckIn ?? ""}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Se sugiere este monto cuando marcas una reserva como Late Check-in; puedes ajustarlo caso por caso.
            </p>
          </div>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700"
        >
          Guardar horarios
        </button>
      </form>
    </div>
  );
}
