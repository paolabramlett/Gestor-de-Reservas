import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Link } from "@react-email/link";
import { Preview } from "@react-email/preview";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";

export type PropuestaCambioProps = {
  codigoReserva: string;
  nombreHuesped: string;
  nombreHotel: string;
  fechaIngresoActual: string;
  fechaSalidaActual: string;
  fechaIngresoNueva: string;
  fechaSalidaNueva: string;
  totalActual: string;
  totalNuevo: string;
  diferencia: string;
  esCobro: boolean;
  urlAceptar: string;
  urlRechazar: string;
  expiresAt: string;
  colorPrimario?: string;
};

export default function PropuestaCambio({
  codigoReserva,
  nombreHuesped,
  nombreHotel,
  fechaIngresoActual,
  fechaSalidaActual,
  fechaIngresoNueva,
  fechaSalidaNueva,
  totalActual,
  totalNuevo,
  diferencia,
  esCobro,
  urlAceptar,
  urlRechazar,
  expiresAt,
  colorPrimario = "#111827",
}: PropuestaCambioProps) {
  return (
    <Html>
      <Head />
      <Preview>Propuesta de cambio en tu reserva {codigoReserva} — {nombreHotel}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ backgroundColor: colorPrimario, borderRadius: 8, padding: "24px 32px", marginBottom: 24 }}>
            <Heading style={{ color: "#fff", margin: 0, fontSize: 20 }}>{nombreHotel}</Heading>
          </Section>

          <Section style={{ backgroundColor: "#fff", borderRadius: 8, padding: "32px", border: "1px solid #e5e7eb" }}>
            <Text style={{ fontSize: 16, color: "#111827", marginTop: 0 }}>Hola {nombreHuesped},</Text>
            <Text style={{ color: "#374151" }}>
              El hotel te propone un cambio en tu reserva <strong>{codigoReserva}</strong>. Revisa los detalles y acepta o rechaza antes del <strong>{expiresAt}</strong>.
            </Text>

            <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />

            <table style={{ width: "100%", borderCollapse: "collapse" as const, marginBottom: 16 }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 11, color: "#6b7280", padding: "4px 0", textTransform: "uppercase" as const, letterSpacing: 1 }}> </td>
                  <td style={{ fontSize: 11, color: "#6b7280", padding: "4px 0", textTransform: "uppercase" as const, letterSpacing: 1 }}>CHECK-IN</td>
                  <td style={{ fontSize: 11, color: "#6b7280", padding: "4px 0", textTransform: "uppercase" as const, letterSpacing: 1 }}>CHECK-OUT</td>
                  <td style={{ fontSize: 11, color: "#6b7280", padding: "4px 0", textTransform: "uppercase" as const, letterSpacing: 1 }}>TOTAL</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 12, color: "#6b7280", padding: "4px 0" }}>Actual</td>
                  <td style={{ color: "#6b7280", padding: "4px 0", fontSize: 14 }}>{fechaIngresoActual}</td>
                  <td style={{ color: "#6b7280", padding: "4px 0", fontSize: 14 }}>{fechaSalidaActual}</td>
                  <td style={{ color: "#6b7280", padding: "4px 0", fontSize: 14 }}>${totalActual} MXN</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 12, color: "#111827", padding: "4px 0", fontWeight: "bold" }}>Nuevo</td>
                  <td style={{ color: "#111827", padding: "4px 0", fontSize: 14, fontWeight: "bold" }}>{fechaIngresoNueva}</td>
                  <td style={{ color: "#111827", padding: "4px 0", fontSize: 14, fontWeight: "bold" }}>{fechaSalidaNueva}</td>
                  <td style={{ color: "#111827", padding: "4px 0", fontSize: 14, fontWeight: "bold" }}>${totalNuevo} MXN</td>
                </tr>
              </tbody>
            </table>

            <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />

            <Section style={{ backgroundColor: esCobro ? "#fef3c7" : "#ecfdf5", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
              {esCobro ? (
                <Text style={{ margin: 0, color: "#92400e", fontSize: 14 }}>
                  Al aceptar, se realizará un <strong>cargo adicional de ${diferencia} MXN</strong> a tu método de pago original (incluye comisión bancaria).
                </Text>
              ) : (
                <Text style={{ margin: 0, color: "#065f46", fontSize: 14 }}>
                  Al aceptar, recibirás un <strong>reembolso de ${diferencia} MXN</strong> en tu método de pago original en 5–10 días hábiles (descontando comisión bancaria no recuperable).
                </Text>
              )}
            </Section>

            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <tbody>
                <tr>
                  <td style={{ paddingRight: 8 }}>
                    <Link
                      href={urlAceptar}
                      style={{
                        display: "block",
                        backgroundColor: colorPrimario,
                        color: "#fff",
                        textAlign: "center" as const,
                        padding: "12px 24px",
                        borderRadius: 8,
                        fontWeight: "bold",
                        fontSize: 14,
                        textDecoration: "none",
                      }}
                    >
                      Aceptar cambio
                    </Link>
                  </td>
                  <td style={{ paddingLeft: 8 }}>
                    <Link
                      href={urlRechazar}
                      style={{
                        display: "block",
                        backgroundColor: "#fff",
                        color: "#374151",
                        textAlign: "center" as const,
                        padding: "12px 24px",
                        borderRadius: 8,
                        fontWeight: "bold",
                        fontSize: 14,
                        textDecoration: "none",
                        border: "1px solid #d1d5db",
                      }}
                    >
                      Rechazar cambio
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>

            <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 20, marginBottom: 0 }}>
              Si no respondes antes del {expiresAt}, la propuesta expirará y tu reserva quedará sin cambios.
            </Text>
          </Section>

          <Text style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" as const, marginTop: 24 }}>
            {nombreHotel} · Reserva {codigoReserva}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
