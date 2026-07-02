import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CalendarioGrid } from "./CalendarioGrid";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; año?: string }>;
}) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const sp = await searchParams;
  const hoy = new Date();
  const mes = sp.mes ? parseInt(sp.mes) : hoy.getMonth() + 1;
  const año = sp.año ? parseInt(sp.año) : hoy.getFullYear();

  const inicio = new Date(año, mes - 1, 1);
  const fin = new Date(año, mes, 0); // último día del mes

  const [habitaciones, reservas, bloqueos] = await Promise.all([
    prisma.habitacion.findMany({
      where: { propiedadId: usuario.propiedadId, activa: true },
      include: { tipoDeHabitacion: true },
      orderBy: [{ tipoDeHabitacion: { nombre: "asc" } }, { numero: "asc" }],
    }),
    prisma.reserva.findMany({
      where: {
        propiedadId: usuario.propiedadId,
        estado: { notIn: ["CANCELADA", "NO_SHOW"] },
        fechaIngreso: { lte: fin },
        fechaSalida: { gt: inicio },
      },
      include: {
        huesped: true,
        asignacion: true,
        pagoManual: true,
      },
    }),
    prisma.bloqueoDeHabitacion.findMany({
      where: {
        propiedadId: usuario.propiedadId,
        fechaInicio: { lte: fin },
        fechaFin: { gte: inicio },
      },
    }),
  ]);

  // Serialize for client component (Dates → ISO strings, Decimals → numbers)
  const habitacionesData = habitaciones.map((h) => ({
    id: h.id,
    numero: h.numero,
    tipoDeHabitacionId: h.tipoDeHabitacionId,
    tipoNombre: h.tipoDeHabitacion.nombre,
  }));

  const reservasData = reservas.map((r) => ({
    id: r.id,
    codigoReserva: r.codigoReserva,
    fechaIngreso: r.fechaIngreso.toISOString().slice(0, 10),
    fechaSalida: r.fechaSalida.toISOString().slice(0, 10),
    numPersonas: r.numPersonas,
    totalMxn: Number(r.totalMxn),
    estado: r.estado as string,
    origen: r.origen as string,
    tipoEspecial: r.tipoEspecial as string | null,
    tipoDeHabitacionId: r.tipoDeHabitacionId,
    nombreHuesped: r.nombreHuesped || r.huesped.nombre,
    huesped: {
      nombre: r.nombreHuesped || r.huesped.nombre,
      email: r.huesped.email,
      telefono: r.huesped.telefono,
    },
    asignacion: r.asignacion ? { habitacionId: r.asignacion.habitacionId } : null,
    pagoManual: r.pagoManual
      ? {
          estadoDePago: r.pagoManual.estadoDePago as string,
          montoAnticipo: r.pagoManual.montoAnticipo ? Number(r.pagoManual.montoAnticipo) : null,
        }
      : null,
  }));

  const bloqueosData = bloqueos.map((b) => ({
    id: b.id,
    habitacionId: b.habitacionId,
    fechaInicio: b.fechaInicio.toISOString().slice(0, 10),
    fechaFin: b.fechaFin.toISOString().slice(0, 10),
    motivo: b.motivo,
  }));

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">
        Calendario de ocupación
      </h1>
      <CalendarioGrid
        habitaciones={habitacionesData}
        reservas={reservasData}
        bloqueos={bloqueosData}
        mes={mes}
        año={año}
      />
    </div>
  );
}
