import { resend } from "./resend";
import { render } from "@react-email/render";
import ConfirmacionReserva from "@/emails/ConfirmacionReserva";
import CancelacionReserva from "@/emails/CancelacionReserva";
import RecordatorioCheckIn from "@/emails/RecordatorioCheckIn";
import AlertaNuevaReserva from "@/emails/AlertaNuevaReserva";
import PagoFallido from "@/emails/PagoFallido";

const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

function fmtFecha(d: Date) {
  return new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export async function enviarConfirmacion(params: {
  emailHuesped: string;
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  tipoHabitacion: string;
  fechaIngreso: Date;
  fechaSalida: Date;
  numPersonas: number;
  totalMxn: number;
  colorPrimario?: string;
}) {
  const html = await render(
    ConfirmacionReserva({
      codigoReserva: params.codigoReserva,
      nombreHuesped: params.nombreHuesped,
      nombreHotel: params.nombreHotel,
      tipoHabitacion: params.tipoHabitacion,
      fechaIngreso: fmtFecha(params.fechaIngreso),
      fechaSalida: fmtFecha(params.fechaSalida),
      numPersonas: params.numPersonas,
      totalMxn: params.totalMxn.toLocaleString("es-MX"),
      colorPrimario: params.colorPrimario,
    })
  );

  return resend.emails.send({
    from: FROM,
    to: params.emailHuesped,
    subject: `Reserva confirmada: ${params.codigoReserva} — ${params.nombreHotel}`,
    html,
  });
}

export async function enviarCancelacion(params: {
  emailHuesped: string;
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  fechaIngreso: Date;
  fechaSalida: Date;
  totalMxn: number;
  montoReembolsadoMxn?: number;
  colorPrimario?: string;
}) {
  const html = await render(
    CancelacionReserva({
      codigoReserva: params.codigoReserva,
      nombreHuesped: params.nombreHuesped,
      nombreHotel: params.nombreHotel,
      fechaIngreso: fmtFecha(params.fechaIngreso),
      fechaSalida: fmtFecha(params.fechaSalida),
      totalMxn: params.totalMxn.toLocaleString("es-MX"),
      montoReembolsadoMxn: params.montoReembolsadoMxn?.toLocaleString("es-MX"),
      colorPrimario: params.colorPrimario,
    })
  );

  return resend.emails.send({
    from: FROM,
    to: params.emailHuesped,
    subject: `Cancelación de reserva ${params.codigoReserva} — ${params.nombreHotel}`,
    html,
  });
}

export async function enviarRecordatorio(params: {
  emailHuesped: string;
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  tipoHabitacion: string;
  fechaIngreso: Date;
  fechaSalida: Date;
  numPersonas: number;
  direccion?: string;
  telefono?: string;
  colorPrimario?: string;
}) {
  const html = await render(
    RecordatorioCheckIn({
      codigoReserva: params.codigoReserva,
      nombreHuesped: params.nombreHuesped,
      nombreHotel: params.nombreHotel,
      tipoHabitacion: params.tipoHabitacion,
      fechaIngreso: fmtFecha(params.fechaIngreso),
      fechaSalida: fmtFecha(params.fechaSalida),
      numPersonas: params.numPersonas,
      direccion: params.direccion,
      telefono: params.telefono,
      colorPrimario: params.colorPrimario,
    })
  );

  return resend.emails.send({
    from: FROM,
    to: params.emailHuesped,
    subject: `Recordatorio: tu check-in es mañana — ${params.codigoReserva}`,
    html,
  });
}

export async function enviarPagoFallido(params: {
  emailHuesped: string;
  nombreHuesped: string;
  nombreHotel: string;
  colorPrimario?: string;
}) {
  const html = await render(
    PagoFallido({
      nombreHuesped: params.nombreHuesped,
      nombreHotel: params.nombreHotel,
      colorPrimario: params.colorPrimario,
    })
  );
  return resend.emails.send({
    from: FROM,
    to: params.emailHuesped,
    subject: `No se pudo procesar tu pago — ${params.nombreHotel}`,
    html,
  });
}

export async function enviarAlertaEquipo(params: {
  emailEquipo: string;
  codigoReserva: string;
  nombreHuesped: string;
  emailHuesped: string;
  telefonoHuesped?: string;
  nombreHotel: string;
  tipoHabitacion: string;
  fechaIngreso: Date;
  fechaSalida: Date;
  numPersonas: number;
  totalMxn: number;
  origen: "ONLINE" | "MANUAL";
  colorPrimario?: string;
}) {
  const html = await render(
    AlertaNuevaReserva({
      codigoReserva: params.codigoReserva,
      nombreHuesped: params.nombreHuesped,
      emailHuesped: params.emailHuesped,
      telefonoHuesped: params.telefonoHuesped,
      nombreHotel: params.nombreHotel,
      tipoHabitacion: params.tipoHabitacion,
      fechaIngreso: fmtFecha(params.fechaIngreso),
      fechaSalida: fmtFecha(params.fechaSalida),
      numPersonas: params.numPersonas,
      totalMxn: params.totalMxn.toLocaleString("es-MX"),
      origen: params.origen,
      colorPrimario: params.colorPrimario,
    })
  );

  return resend.emails.send({
    from: FROM,
    to: params.emailEquipo,
    subject: `Nueva reserva ${params.codigoReserva} — ${params.nombreHuesped}`,
    html,
  });
}
