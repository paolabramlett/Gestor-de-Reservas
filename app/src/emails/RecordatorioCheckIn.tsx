import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Preview } from "@react-email/preview";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";

export type RecordatorioCheckInProps = {
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  tipoHabitacion: string;
  fechaIngreso: string;
  fechaSalida: string;
  numPersonas: number;
  direccion?: string;
  telefono?: string;
  colorPrimario?: string;
};

export default function RecordatorioCheckIn({
  codigoReserva,
  nombreHuesped,
  nombreHotel,
  tipoHabitacion,
  fechaIngreso,
  fechaSalida,
  numPersonas,
  direccion,
  telefono,
  colorPrimario = "#111827",
}: RecordatorioCheckInProps) {
  return (
    <Html>
      <Head />
      <Preview>Tu check-in en {nombreHotel} es mañana — {codigoReserva}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ backgroundColor: colorPrimario, borderRadius: 8, padding: "24px 32px", marginBottom: 24 }}>
            <Heading style={{ color: "#fff", margin: 0, fontSize: 20 }}>{nombreHotel}</Heading>
          </Section>

          <Section style={{ backgroundColor: "#fff", borderRadius: 8, padding: "32px", border: "1px solid #e5e7eb" }}>
            <Text style={{ fontSize: 16, color: "#111827", marginTop: 0 }}>Hola {nombreHuesped},</Text>
            <Text style={{ color: "#374151" }}>
              Te recordamos que tu check-in es <strong>mañana</strong>. ¡Te esperamos!
            </Text>

            <Section style={{ backgroundColor: "#f3f4f6", borderRadius: 6, padding: "12px 20px", margin: "16px 0" }}>
              <Text style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>CÓDIGO DE RESERVA</Text>
              <Text style={{ margin: "2px 0 0", fontFamily: "monospace", fontWeight: "bold", fontSize: 20, color: "#111827" }}>
                {codigoReserva}
              </Text>
            </Section>

            <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />

            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 12, color: "#6b7280", padding: "4px 0", width: "50%" }}>TIPO DE HABITACIÓN</td>
                  <td style={{ fontSize: 12, color: "#6b7280", padding: "4px 0" }}>PERSONAS</td>
                </tr>
                <tr>
                  <td style={{ color: "#111827", padding: "0 0 12px" }}>{tipoHabitacion}</td>
                  <td style={{ color: "#111827", padding: "0 0 12px" }}>{numPersonas}</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 12, color: "#6b7280", padding: "4px 0" }}>CHECK-IN</td>
                  <td style={{ fontSize: 12, color: "#6b7280", padding: "4px 0" }}>CHECK-OUT</td>
                </tr>
                <tr>
                  <td style={{ color: "#111827", padding: "0 0 12px" }}>{fechaIngreso}</td>
                  <td style={{ color: "#111827", padding: "0 0 12px" }}>{fechaSalida}</td>
                </tr>
              </tbody>
            </table>

            {(direccion || telefono) && (
              <>
                <Hr style={{ borderColor: "#e5e7eb", margin: "8px 0 16px" }} />
                {direccion && (
                  <Text style={{ margin: 0, color: "#374151", fontSize: 14 }}>📍 {direccion}</Text>
                )}
                {telefono && (
                  <Text style={{ margin: "8px 0 0", color: "#374151", fontSize: 14 }}>📞 {telefono}</Text>
                )}
              </>
            )}
          </Section>

          <Text style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" as const, marginTop: 24 }}>
            {nombreHotel} · Reserva {codigoReserva}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
