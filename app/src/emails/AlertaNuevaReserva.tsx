import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Html } from "@react-email/html";
import { Preview } from "@react-email/preview";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";

export type AlertaNuevaReservaProps = {
  codigoReserva: string;
  nombreHuesped: string;
  emailHuesped: string;
  telefonoHuesped?: string;
  nombreHotel: string;
  tipoHabitacion: string;
  fechaIngreso: string;
  fechaSalida: string;
  numPersonas: number;
  totalMxn: string;
  origen: "ONLINE" | "MANUAL";
  colorPrimario?: string;
};

export default function AlertaNuevaReserva({
  codigoReserva,
  nombreHuesped,
  emailHuesped,
  telefonoHuesped,
  nombreHotel,
  tipoHabitacion,
  fechaIngreso,
  fechaSalida,
  numPersonas,
  totalMxn,
  origen,
  colorPrimario = "#111827",
}: AlertaNuevaReservaProps) {
  return (
    <Html>
      <Head />
      <Preview>Nueva reserva {codigoReserva} — {nombreHuesped} ({origen === "ONLINE" ? "Online" : "Manual"})</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ backgroundColor: colorPrimario, borderRadius: 8, padding: "24px 32px", marginBottom: 24 }}>
            <Heading style={{ color: "#fff", margin: 0, fontSize: 20 }}>{nombreHotel} — Nueva reserva</Heading>
          </Section>

          <Section style={{ backgroundColor: "#fff", borderRadius: 8, padding: "32px", border: "1px solid #e5e7eb" }}>
            <Text style={{ fontSize: 16, color: "#111827", marginTop: 0 }}>
              Nueva reserva{" "}
              <span style={{
                backgroundColor: origen === "ONLINE" ? "#dbeafe" : "#f3f4f6",
                color: origen === "ONLINE" ? "#1d4ed8" : "#374151",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 13,
              }}>
                {origen === "ONLINE" ? "Online · Stripe" : "Manual"}
              </span>
            </Text>

            <Section style={{ backgroundColor: "#f3f4f6", borderRadius: 6, padding: "12px 20px", margin: "8px 0 20px" }}>
              <Text style={{ margin: 0, fontFamily: "monospace", fontWeight: "bold", fontSize: 22, color: "#111827" }}>
                {codigoReserva}
              </Text>
            </Section>

            <Hr style={{ borderColor: "#e5e7eb", margin: "0 0 16px" }} />

            <Text style={{ margin: "0 0 2px", fontSize: 12, color: "#6b7280" }}>HUÉSPED</Text>
            <Text style={{ margin: "0 0 2px", fontWeight: "bold", color: "#111827" }}>{nombreHuesped}</Text>
            <Text style={{ margin: "0 0 2px", color: "#374151", fontSize: 14 }}>{emailHuesped}</Text>
            {telefonoHuesped && (
              <Text style={{ margin: "0 0 16px", color: "#374151", fontSize: 14 }}>{telefonoHuesped}</Text>
            )}

            <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />

            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 12, color: "#6b7280", padding: "4px 0", width: "50%" }}>TIPO</td>
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

            <Hr style={{ borderColor: "#e5e7eb", margin: "8px 0 16px" }} />

            <table style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: "bold", color: "#111827" }}>Total</td>
                  <td style={{ textAlign: "right" as const, fontWeight: "bold", color: "#111827" }}>${totalMxn} MXN</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Text style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" as const, marginTop: 24 }}>
            {nombreHotel} · Panel interno
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
