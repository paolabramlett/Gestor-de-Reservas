import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Preview } from "@react-email/preview";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";

export type CambioAceptadoHuespedProps = {
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  fechaIngresoNueva: string;
  fechaSalidaNueva: string;
  totalNuevo: string;
  diferencia: string;
  esCobro: boolean;
  cobroManual: boolean;
  colorPrimario?: string;
};

export default function CambioAceptadoHuesped({
  codigoReserva,
  nombreHuesped,
  nombreHotel,
  fechaIngresoNueva,
  fechaSalidaNueva,
  totalNuevo,
  diferencia,
  esCobro,
  cobroManual,
  colorPrimario = "#111827",
}: CambioAceptadoHuespedProps) {
  return (
    <Html>
      <Head />
      <Preview>✅ Tu reserva {codigoReserva} ha sido actualizada — {nombreHotel}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ backgroundColor: colorPrimario, borderRadius: 8, padding: "24px 32px", marginBottom: 24 }}>
            <Heading style={{ color: "#fff", margin: 0, fontSize: 20 }}>{nombreHotel}</Heading>
          </Section>

          <Section style={{ backgroundColor: "#fff", borderRadius: 8, padding: "32px", border: "1px solid #e5e7eb" }}>
            <Text style={{ fontSize: 16, color: "#111827", marginTop: 0 }}>Hola {nombreHuesped},</Text>
            <Text style={{ color: "#374151" }}>
              Has aceptado el cambio de fechas en tu reserva <strong>{codigoReserva}</strong>. Aquí está el resumen actualizado:
            </Text>

            <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />

            <table style={{ width: "100%", borderCollapse: "collapse" as const, marginBottom: 16 }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 11, color: "#6b7280", padding: "4px 0", textTransform: "uppercase" as const, letterSpacing: 1 }}>CHECK-IN</td>
                  <td style={{ fontSize: 11, color: "#6b7280", padding: "4px 0", textTransform: "uppercase" as const, letterSpacing: 1 }}>CHECK-OUT</td>
                  <td style={{ fontSize: 11, color: "#6b7280", padding: "4px 0", textTransform: "uppercase" as const, letterSpacing: 1 }}>TOTAL</td>
                </tr>
                <tr>
                  <td style={{ color: "#111827", padding: "4px 0", fontWeight: "bold" }}>{fechaIngresoNueva}</td>
                  <td style={{ color: "#111827", padding: "4px 0", fontWeight: "bold" }}>{fechaSalidaNueva}</td>
                  <td style={{ color: "#111827", padding: "4px 0", fontWeight: "bold" }}>${totalNuevo} MXN</td>
                </tr>
              </tbody>
            </table>

            <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />

            {esCobro ? (
              cobroManual ? (
                <Section style={{ backgroundColor: "#fef3c7", borderRadius: 8, padding: "16px 20px" }}>
                  <Text style={{ margin: 0, color: "#92400e", fontSize: 14 }}>
                    Hay un cargo adicional de <strong>${diferencia} MXN</strong> por esta modificación. El hotel se pondrá en contacto contigo para coordinar el pago.
                  </Text>
                </Section>
              ) : (
                <Section style={{ backgroundColor: "#fef3c7", borderRadius: 8, padding: "16px 20px" }}>
                  <Text style={{ margin: 0, color: "#92400e", fontSize: 14 }}>
                    Se procesará un cargo adicional de <strong>${diferencia} MXN</strong> a tu método de pago original.
                  </Text>
                </Section>
              )
            ) : (
              <Section style={{ backgroundColor: "#ecfdf5", borderRadius: 8, padding: "16px 20px" }}>
                <Text style={{ margin: 0, color: "#065f46", fontSize: 14 }}>
                  Recibirás un reembolso de <strong>${diferencia} MXN</strong> en tu método de pago original en 5–10 días hábiles.
                </Text>
              </Section>
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
