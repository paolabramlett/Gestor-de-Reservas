import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Preview } from "@react-email/preview";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";

export type CancelacionReservaProps = {
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  fechaIngreso: string;
  fechaSalida: string;
  totalMxn: string;
  montoReembolsadoMxn?: string;
  colorPrimario?: string;
};

export default function CancelacionReserva({
  codigoReserva,
  nombreHuesped,
  nombreHotel,
  fechaIngreso,
  fechaSalida,
  totalMxn,
  montoReembolsadoMxn,
  colorPrimario = "#111827",
}: CancelacionReservaProps) {
  const hayReembolso = montoReembolsadoMxn && Number(montoReembolsadoMxn.replace(/,/g, "")) > 0;

  return (
    <Html>
      <Head />
      <Preview>Cancelación de tu reserva {codigoReserva} en {nombreHotel}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ backgroundColor: colorPrimario, borderRadius: 8, padding: "24px 32px", marginBottom: 24 }}>
            <Heading style={{ color: "#fff", margin: 0, fontSize: 20 }}>{nombreHotel}</Heading>
          </Section>

          <Section style={{ backgroundColor: "#fff", borderRadius: 8, padding: "32px", border: "1px solid #e5e7eb" }}>
            <Text style={{ fontSize: 16, color: "#111827", marginTop: 0 }}>Hola {nombreHuesped},</Text>
            <Text style={{ color: "#374151" }}>
              Tu reserva <strong>{codigoReserva}</strong> ha sido cancelada.
            </Text>

            <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />

            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 12, color: "#6b7280", padding: "4px 0", width: "50%" }}>CHECK-IN</td>
                  <td style={{ fontSize: 12, color: "#6b7280", padding: "4px 0" }}>CHECK-OUT</td>
                </tr>
                <tr>
                  <td style={{ color: "#111827", padding: "0 0 12px" }}>{fechaIngreso}</td>
                  <td style={{ color: "#111827", padding: "0 0 12px" }}>{fechaSalida}</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 12, color: "#6b7280", padding: "4px 0" }}>TOTAL PAGADO</td>
                  {hayReembolso && (
                    <td style={{ fontSize: 12, color: "#6b7280", padding: "4px 0" }}>REEMBOLSO</td>
                  )}
                </tr>
                <tr>
                  <td style={{ color: "#111827", padding: "0 0 12px" }}>${totalMxn} MXN</td>
                  {hayReembolso && (
                    <td style={{ color: "#059669", fontWeight: "bold", padding: "0 0 12px" }}>
                      ${montoReembolsadoMxn} MXN
                    </td>
                  )}
                </tr>
              </tbody>
            </table>

            <Hr style={{ borderColor: "#e5e7eb", margin: "8px 0 16px" }} />

            {hayReembolso ? (
              <Text style={{ color: "#374151", fontSize: 14 }}>
                El reembolso de <strong>${montoReembolsadoMxn} MXN</strong> se acreditará a tu método de pago original en 5–10 días hábiles.
              </Text>
            ) : (
              <Text style={{ color: "#6b7280", fontSize: 14 }}>
                Esta cancelación no incluye reembolso según la política aplicada.
              </Text>
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
