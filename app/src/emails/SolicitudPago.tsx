import { Body } from "@react-email/body";
import { Button } from "@react-email/button";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Preview } from "@react-email/preview";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";

export type SolicitudPagoProps = {
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  tipoHabitacion: string;
  fechaIngreso: string;
  fechaSalida: string;
  numPersonas: number;
  montoCobrar: string;
  esPagoCompleto: boolean;
  linkPago: string;
  expiraEn: string;
  colorPrimario?: string;
};

export default function SolicitudPago({
  codigoReserva,
  nombreHuesped,
  nombreHotel,
  tipoHabitacion,
  fechaIngreso,
  fechaSalida,
  numPersonas,
  montoCobrar,
  esPagoCompleto,
  linkPago,
  expiraEn,
  colorPrimario = "#111827",
}: SolicitudPagoProps) {
  return (
    <Html>
      <Head />
      <Preview>Tu reserva {codigoReserva} está apartada — completa el pago para confirmarla</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ backgroundColor: colorPrimario, borderRadius: 8, padding: "24px 32px", marginBottom: 24 }}>
            <Heading style={{ color: "#fff", margin: 0, fontSize: 20 }}>{nombreHotel}</Heading>
          </Section>

          <Section style={{ backgroundColor: "#fff", borderRadius: 8, padding: "32px", border: "1px solid #e5e7eb" }}>
            <Text style={{ fontSize: 16, color: "#111827", marginTop: 0 }}>
              Hola {nombreHuesped},
            </Text>
            <Text style={{ color: "#374151" }}>
              Tu reserva está <strong>apartada</strong>. Para confirmarla, completa el pago de{" "}
              {esPagoCompleto ? "la reserva completa" : "tu anticipo"} antes de que expire el link.
            </Text>

            <Section style={{ backgroundColor: "#f3f4f6", borderRadius: 6, padding: "16px 24px", margin: "16px 0", textAlign: "center" as const }}>
              <Text style={{ margin: 0, fontSize: 12, color: "#6b7280", letterSpacing: 1 }}>CÓDIGO DE RESERVA</Text>
              <Text style={{ margin: "4px 0 0", fontSize: 28, fontWeight: "bold", fontFamily: "monospace", color: "#111827", letterSpacing: 2 }}>
                {codigoReserva}
              </Text>
            </Section>

            <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />

            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 0", fontSize: 12, color: "#6b7280", width: "50%" }}>TIPO DE HABITACIÓN</td>
                  <td style={{ padding: "4px 0", fontSize: 12, color: "#6b7280" }}>PERSONAS</td>
                </tr>
                <tr>
                  <td style={{ padding: "0 0 12px", color: "#111827" }}>{tipoHabitacion}</td>
                  <td style={{ padding: "0 0 12px", color: "#111827" }}>{numPersonas}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0", fontSize: 12, color: "#6b7280" }}>CHECK-IN</td>
                  <td style={{ padding: "4px 0", fontSize: 12, color: "#6b7280" }}>CHECK-OUT</td>
                </tr>
                <tr>
                  <td style={{ padding: "0 0 12px", color: "#111827" }}>{fechaIngreso}</td>
                  <td style={{ padding: "0 0 12px", color: "#111827" }}>{fechaSalida}</td>
                </tr>
              </tbody>
            </table>

            <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />

            <table style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: "bold", color: "#111827", fontSize: 16 }}>
                    {esPagoCompleto ? "Total a pagar" : "Anticipo a pagar"}
                  </td>
                  <td style={{ textAlign: "right" as const, fontWeight: "bold", color: "#111827", fontSize: 16 }}>
                    ${montoCobrar} MXN
                  </td>
                </tr>
              </tbody>
            </table>

            <Section style={{ textAlign: "center" as const, margin: "32px 0 16px" }}>
              <Button
                href={linkPago}
                style={{
                  backgroundColor: colorPrimario,
                  color: "#fff",
                  borderRadius: 8,
                  padding: "14px 32px",
                  fontSize: 15,
                  fontWeight: "bold",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Completar pago
              </Button>
            </Section>

            <Section style={{ backgroundColor: "#fffbeb", borderRadius: 6, padding: "12px 16px", border: "1px solid #fde68a" }}>
              <Text style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
                ⏰ Este link expira el <strong>{expiraEn}</strong>. Si no se completa el pago, tu reserva será cancelada automáticamente.
              </Text>
            </Section>
          </Section>

          <Text style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" as const, marginTop: 24 }}>
            {nombreHotel} · Reserva {codigoReserva}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
