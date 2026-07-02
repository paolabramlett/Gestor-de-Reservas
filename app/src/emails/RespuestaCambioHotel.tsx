import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Preview } from "@react-email/preview";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";

export type RespuestaCambioHotelProps = {
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  fechaIngresoNueva: string;
  fechaSalidaNueva: string;
  totalNuevo: string;
  diferencia: string;
  esCobro: boolean;
  respuesta: "ACEPTADA" | "RECHAZADA" | "EXPIRADA";
  colorPrimario?: string;
};

export default function RespuestaCambioHotel({
  codigoReserva,
  nombreHuesped,
  nombreHotel,
  fechaIngresoNueva,
  fechaSalidaNueva,
  totalNuevo,
  diferencia,
  esCobro,
  respuesta,
  colorPrimario = "#111827",
}: RespuestaCambioHotelProps) {
  const config = {
    ACEPTADA: { emoji: "✅", titulo: "Cambio aceptado por el huésped", color: "#065f46", bg: "#ecfdf5" },
    RECHAZADA: { emoji: "❌", titulo: "Cambio rechazado por el huésped", color: "#991b1b", bg: "#fef2f2" },
    EXPIRADA: { emoji: "⏰", titulo: "Propuesta de cambio expirada", color: "#92400e", bg: "#fef3c7" },
  }[respuesta];

  return (
    <Html>
      <Head />
      <Preview>{config.emoji} {config.titulo} — Reserva {codigoReserva}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ backgroundColor: colorPrimario, borderRadius: 8, padding: "24px 32px", marginBottom: 24 }}>
            <Heading style={{ color: "#fff", margin: 0, fontSize: 20 }}>{nombreHotel}</Heading>
          </Section>

          <Section style={{ backgroundColor: "#fff", borderRadius: 8, padding: "32px", border: "1px solid #e5e7eb" }}>
            <Section style={{ backgroundColor: config.bg, borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
              <Text style={{ margin: 0, color: config.color, fontWeight: "bold", fontSize: 15 }}>
                {config.emoji} {config.titulo}
              </Text>
            </Section>

            <Text style={{ color: "#374151", marginTop: 0 }}>
              Reserva <strong>{codigoReserva}</strong> — {nombreHuesped}
            </Text>

            {respuesta === "ACEPTADA" && (
              <>
                <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />
                <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
                  <tbody>
                    <tr>
                      <td style={{ fontSize: 11, color: "#6b7280", padding: "4px 0", textTransform: "uppercase" as const }}>CHECK-IN</td>
                      <td style={{ fontSize: 11, color: "#6b7280", padding: "4px 0", textTransform: "uppercase" as const }}>CHECK-OUT</td>
                      <td style={{ fontSize: 11, color: "#6b7280", padding: "4px 0", textTransform: "uppercase" as const }}>NUEVO TOTAL</td>
                    </tr>
                    <tr>
                      <td style={{ color: "#111827", padding: "4px 0" }}>{fechaIngresoNueva}</td>
                      <td style={{ color: "#111827", padding: "4px 0" }}>{fechaSalidaNueva}</td>
                      <td style={{ color: "#111827", padding: "4px 0", fontWeight: "bold" }}>${totalNuevo} MXN</td>
                    </tr>
                  </tbody>
                </table>
                <Text style={{ fontSize: 13, color: "#374151", marginTop: 12 }}>
                  {esCobro
                    ? `Se ha realizado un cargo adicional de $${diferencia} MXN al método de pago del huésped.`
                    : `Se ha procesado un reembolso de $${diferencia} MXN al método de pago del huésped.`}
                </Text>
              </>
            )}

            {respuesta === "RECHAZADA" && (
              <Text style={{ color: "#6b7280", fontSize: 13 }}>
                La reserva original permanece sin cambios.
              </Text>
            )}

            {respuesta === "EXPIRADA" && (
              <Text style={{ color: "#6b7280", fontSize: 13 }}>
                El huésped no respondió a tiempo. La reserva original permanece sin cambios. Puedes enviar una nueva propuesta si lo deseas.
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
