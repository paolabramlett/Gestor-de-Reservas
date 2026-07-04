import { resend } from "./resend";
import { render } from "@react-email/render";
import ConfirmacionReserva from "@/emails/ConfirmacionReserva";
import SolicitudPago from "@/emails/SolicitudPago";
import CancelacionReserva from "@/emails/CancelacionReserva";
import RecordatorioCheckIn from "@/emails/RecordatorioCheckIn";
import AlertaNuevaReserva from "@/emails/AlertaNuevaReserva";
import PagoFallido from "@/emails/PagoFallido";
import PropuestaCambio from "@/emails/PropuestaCambio";
import RespuestaCambioHotel from "@/emails/RespuestaCambioHotel";
import CambioAceptadoHuesped from "@/emails/CambioAceptadoHuesped";
import InvitacionEquipo from "@/emails/InvitacionEquipo";

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

export async function enviarPropuestaCambio(params: {
  emailHuesped: string;
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  fechaIngresoActual: Date;
  fechaSalidaActual: Date;
  fechaIngresoNueva: Date;
  fechaSalidaNueva: Date;
  totalActual: number;
  totalNuevo: number;
  diferencia: number;
  esCobro: boolean;
  urlAceptar: string;
  urlRechazar: string;
  expiresAt: Date;
  colorPrimario?: string;
}) {
  const html = await render(
    PropuestaCambio({
      codigoReserva: params.codigoReserva,
      nombreHuesped: params.nombreHuesped,
      nombreHotel: params.nombreHotel,
      fechaIngresoActual: fmtFecha(params.fechaIngresoActual),
      fechaSalidaActual: fmtFecha(params.fechaSalidaActual),
      fechaIngresoNueva: fmtFecha(params.fechaIngresoNueva),
      fechaSalidaNueva: fmtFecha(params.fechaSalidaNueva),
      totalActual: params.totalActual.toLocaleString("es-MX"),
      totalNuevo: params.totalNuevo.toLocaleString("es-MX"),
      diferencia: Math.abs(params.diferencia).toLocaleString("es-MX"),
      esCobro: params.esCobro,
      urlAceptar: params.urlAceptar,
      urlRechazar: params.urlRechazar,
      expiresAt: fmtFecha(params.expiresAt),
      colorPrimario: params.colorPrimario,
    })
  );
  return resend.emails.send({
    from: FROM,
    to: params.emailHuesped,
    subject: `Propuesta de cambio en tu reserva ${params.codigoReserva} — ${params.nombreHotel}`,
    html,
  });
}

export async function enviarRespuestaCambioHotel(params: {
  emailHotel: string;
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  fechaIngresoNueva: Date;
  fechaSalidaNueva: Date;
  totalNuevo: number;
  diferencia: number;
  esCobro: boolean;
  respuesta: "ACEPTADA" | "RECHAZADA" | "EXPIRADA";
  colorPrimario?: string;
}) {
  const html = await render(
    RespuestaCambioHotel({
      codigoReserva: params.codigoReserva,
      nombreHuesped: params.nombreHuesped,
      nombreHotel: params.nombreHotel,
      fechaIngresoNueva: fmtFecha(params.fechaIngresoNueva),
      fechaSalidaNueva: fmtFecha(params.fechaSalidaNueva),
      totalNuevo: params.totalNuevo.toLocaleString("es-MX"),
      diferencia: Math.abs(params.diferencia).toLocaleString("es-MX"),
      esCobro: params.esCobro,
      respuesta: params.respuesta,
      colorPrimario: params.colorPrimario,
    })
  );
  const subjectMap = {
    ACEPTADA: `✅ Cambio aceptado — Reserva ${params.codigoReserva}`,
    RECHAZADA: `❌ Cambio rechazado — Reserva ${params.codigoReserva}`,
    EXPIRADA: `⏰ Propuesta expirada — Reserva ${params.codigoReserva}`,
  };
  return resend.emails.send({
    from: FROM,
    to: params.emailHotel,
    subject: subjectMap[params.respuesta],
    html,
  });
}

export async function enviarCambioAceptadoHuesped(params: {
  emailHuesped: string;
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  fechaIngresoNueva: Date;
  fechaSalidaNueva: Date;
  totalNuevo: number;
  diferencia: number;
  esCobro: boolean;
  cobroManual: boolean;
  colorPrimario?: string;
}) {
  const html = await render(
    CambioAceptadoHuesped({
      codigoReserva: params.codigoReserva,
      nombreHuesped: params.nombreHuesped,
      nombreHotel: params.nombreHotel,
      fechaIngresoNueva: fmtFecha(params.fechaIngresoNueva),
      fechaSalidaNueva: fmtFecha(params.fechaSalidaNueva),
      totalNuevo: params.totalNuevo.toLocaleString("es-MX"),
      diferencia: Math.abs(params.diferencia).toLocaleString("es-MX"),
      esCobro: params.esCobro,
      cobroManual: params.cobroManual,
      colorPrimario: params.colorPrimario,
    })
  );
  return resend.emails.send({
    from: FROM,
    to: params.emailHuesped,
    subject: `✅ Tu reserva ${params.codigoReserva} ha sido actualizada — ${params.nombreHotel}`,
    html,
  });
}

export async function enviarSolicitudPago(params: {
  emailHuesped: string;
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  tipoHabitacion: string;
  fechaIngreso: Date;
  fechaSalida: Date;
  numPersonas: number;
  montoCobrar: number;
  esPagoCompleto: boolean;
  linkPago: string;
  expiraEn: Date;
  colorPrimario?: string;
}) {
  const html = await render(
    SolicitudPago({
      codigoReserva: params.codigoReserva,
      nombreHuesped: params.nombreHuesped,
      nombreHotel: params.nombreHotel,
      tipoHabitacion: params.tipoHabitacion,
      fechaIngreso: fmtFecha(params.fechaIngreso),
      fechaSalida: fmtFecha(params.fechaSalida),
      numPersonas: params.numPersonas,
      montoCobrar: params.montoCobrar.toLocaleString("es-MX"),
      esPagoCompleto: params.esPagoCompleto,
      linkPago: params.linkPago,
      expiraEn: fmtFecha(params.expiraEn),
      colorPrimario: params.colorPrimario,
    })
  );
  return resend.emails.send({
    from: FROM,
    to: params.emailHuesped,
    subject: `💳 Completa el pago de tu reserva ${params.codigoReserva} — ${params.nombreHotel}`,
    html,
  });
}

export async function enviarInvitacionEquipo(params: {
  email: string;
  nombreHotel: string;
  rol: string;
  linkInvitacion: string;
  expiraEn: Date;
  colorPrimario?: string;
}) {
  const html = await render(
    InvitacionEquipo({
      nombreHotel: params.nombreHotel,
      rol: params.rol,
      linkInvitacion: params.linkInvitacion,
      expiraEn: fmtFecha(params.expiraEn),
      colorPrimario: params.colorPrimario,
    })
  );
  return resend.emails.send({
    from: FROM,
    to: params.email,
    subject: `Te invitaron al equipo de ${params.nombreHotel} en Roomly`,
    html,
  });
}
