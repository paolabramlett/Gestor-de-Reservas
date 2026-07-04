import { Body } from "@react-email/body";
import { Button } from "@react-email/button";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Html } from "@react-email/html";
import { Preview } from "@react-email/preview";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  RESERVACIONES: "Reservaciones",
  FINANZAS: "Finanzas",
  SUPER_ADMIN: "Super Admin",
};

export type InvitacionEquipoProps = {
  nombreHotel: string;
  rol: string;
  linkInvitacion: string;
  expiraEn: string;
  colorPrimario?: string;
};

export default function InvitacionEquipo({
  nombreHotel,
  rol,
  linkInvitacion,
  expiraEn,
  colorPrimario = "#111827",
}: InvitacionEquipoProps) {
  return (
    <Html>
      <Head />
      <Preview>Te invitaron a formar parte del equipo de {nombreHotel} en Roomly</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
          <Section style={{ backgroundColor: colorPrimario, borderRadius: 8, padding: "24px 32px", marginBottom: 24 }}>
            <Heading style={{ color: "#fff", margin: 0, fontSize: 20 }}>{nombreHotel}</Heading>
          </Section>

          <Section style={{ backgroundColor: "#fff", borderRadius: 8, padding: "32px", border: "1px solid #e5e7eb" }}>
            <Text style={{ fontSize: 16, color: "#111827", marginTop: 0 }}>
              Te invitaron a unirte al equipo de <strong>{nombreHotel}</strong> en Roomly, con el rol de{" "}
              <strong>{ROL_LABEL[rol] ?? rol}</strong>.
            </Text>
            <Text style={{ color: "#374151" }}>
              Acepta la invitación para acceder al panel. Si no tienes cuenta, podrás crear una en el mismo paso.
            </Text>

            <Section style={{ textAlign: "center" as const, margin: "32px 0 16px" }}>
              <Button
                href={linkInvitacion}
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
                Aceptar invitación
              </Button>
            </Section>

            <Section style={{ backgroundColor: "#fffbeb", borderRadius: 6, padding: "12px 16px", border: "1px solid #fde68a" }}>
              <Text style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
                ⏰ Esta invitación expira el <strong>{expiraEn}</strong>.
              </Text>
            </Section>
          </Section>

          <Text style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" as const, marginTop: 24 }}>
            {nombreHotel} · Invitación de equipo
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
