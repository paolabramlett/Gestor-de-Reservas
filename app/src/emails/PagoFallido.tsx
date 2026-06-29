import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Html } from "@react-email/html";
import { Preview } from "@react-email/preview";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";

export type PagoFallidoProps = {
  nombreHuesped: string;
  nombreHotel: string;
  colorPrimario?: string;
};

export default function PagoFallido({
  nombreHuesped,
  nombreHotel,
  colorPrimario = "#111827",
}: PagoFallidoProps) {
  return (
    <Html>
      <Head />
      <Preview>No se pudo procesar tu pago en {nombreHotel}</Preview>
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
              No pudimos procesar tu pago. Tu reserva <strong>no ha sido confirmada</strong>.
            </Text>
            <Text style={{ color: "#374151" }}>
              Esto puede deberse a fondos insuficientes, un dato incorrecto de la tarjeta, o una restricción de tu banco. Te sugerimos:
            </Text>
            <ul style={{ color: "#374151", paddingLeft: 20 }}>
              <li>Verificar los datos de tu tarjeta</li>
              <li>Intentar con otro método de pago</li>
              <li>Contactar a tu banco si el problema persiste</li>
            </ul>
            <Text style={{ color: "#374151" }}>
              Puedes intentar tu reserva nuevamente en cualquier momento.
            </Text>
          </Section>

          <Text style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" as const, marginTop: 24 }}>
            {nombreHotel}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
