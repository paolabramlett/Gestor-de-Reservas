import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Servicio",
  description: "Términos y condiciones de uso de Roomly.",
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700">← Volver a Roomly</Link>

        <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-2">Términos de Servicio</h1>
        <p className="text-sm text-gray-400 mb-10">Última actualización: julio de 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-gray-700">
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">1. Aceptación</h2>
            <p>
              Al crear una cuenta o usar Roomly (&quot;la Plataforma&quot;), aceptas estos Términos de
              Servicio y nuestro{" "}
              <Link href="/privacidad" className="text-blue-600 underline">Aviso de Privacidad</Link>.
              Si no estás de acuerdo, no debes usar la Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">2. Qué es Roomly</h2>
            <p>
              Roomly es un software de gestión hotelera (panel de reservas, calendario, pagos y
              reportes) para hoteles pequeños e independientes. No somos una agencia de viajes ni
              parte en el contrato de alojamiento entre el hotel y sus huéspedes — solo proveemos la
              herramienta.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">3. Cuenta y responsabilidad del hotel</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Eres responsable de la exactitud de la información de tu hotel, tarifas y disponibilidad.</li>
              <li>Eres responsable de obtener el consentimiento de tus huéspedes para tratar sus datos personales conforme a la ley aplicable.</li>
              <li>Eres responsable de mantener la confidencialidad de las credenciales de acceso de tu equipo.</li>
              <li>No debes usar la Plataforma para actividades ilegales, fraudulentas o que violen derechos de terceros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">4. Planes y pagos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Roomly opera mediante suscripción mensual (plan Esencial o Pro), cobrada de forma recurrente vía Stripe.</li>
              <li>Puedes cambiar de plan o cancelar tu suscripción en cualquier momento desde Configuración → Plan.</li>
              <li>La cancelación aplica al final de tu periodo de facturación actual; no se hacen reembolsos proporcionales por el tiempo restante salvo que la ley aplicable exija lo contrario.</li>
              <li>Los pagos que tus huéspedes hacen a través de tu portal de reservas (plan Pro) se procesan directamente vía Stripe; Roomly no retiene esos fondos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">5. Disponibilidad del servicio</h2>
            <p>
              Nos esforzamos por mantener la Plataforma disponible, pero no garantizamos un servicio
              ininterrumpido o libre de errores. Podemos suspender el servicio temporalmente para
              mantenimiento, con aviso cuando sea razonablemente posible.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">6. Limitación de responsabilidad</h2>
            <p>
              Roomly se ofrece &quot;tal cual&quot;. En la máxima medida permitida por la ley, no somos
              responsables por pérdidas indirectas, de ingresos o de datos derivadas del uso de la
              Plataforma, ni por disputas entre el hotel y sus huéspedes. Nuestra responsabilidad total
              frente a ti se limita al monto pagado por tu suscripción en los tres meses previos al
              reclamo.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">7. Terminación</h2>
            <p>
              Podemos suspender o cancelar tu cuenta si incumples estos Términos, incluyendo el uso
              indebido de datos de huéspedes o actividad fraudulenta. Puedes cancelar tu cuenta en
              cualquier momento; tus datos se conservan conforme a nuestro Aviso de Privacidad.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">8. Cambios a estos términos</h2>
            <p>
              Podemos actualizar estos Términos. Si los cambios son significativos, te avisaremos por
              correo o mediante un aviso visible en la Plataforma antes de que entren en vigor.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">9. Contacto</h2>
            <p>
              Para dudas sobre estos Términos, escríbenos a{" "}
              <a href="mailto:contacto.roomly@gmail.com" className="text-blue-600 underline">
                contacto.roomly@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
          Este documento es una plantilla base y no sustituye una revisión legal. Antes de operar
          con hoteles reales, te recomendamos que un abogado la revise y ajuste a tu operación.
        </div>
      </div>
    </div>
  );
}
