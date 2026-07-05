import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de Privacidad",
  description: "Aviso de privacidad de Roomly conforme a la LFPDPPP.",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700">← Volver a Roomly</Link>

        <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-2">Aviso de Privacidad</h1>
        <p className="text-sm text-gray-400 mb-10">Última actualización: julio de 2026</p>

        <div className="prose-legal space-y-8 text-sm leading-relaxed text-gray-700">
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">1. Responsable</h2>
            <p>
              Roomly (&quot;nosotros&quot; o &quot;la Plataforma&quot;) es responsable del tratamiento de tus
              datos personales conforme a la Ley Federal de Protección de Datos Personales en
              Posesión de los Particulares (LFPDPPP) de México. Puedes contactarnos en{" "}
              <a href="mailto:contacto.roomly@gmail.com" className="text-blue-600 underline">
                contacto.roomly@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">2. A quién aplica este aviso</h2>
            <p>Este aviso cubre tres tipos de personas que interactúan con Roomly:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Hoteles y su equipo</strong> — quienes usan el panel de administración.</li>
              <li><strong>Huéspedes</strong> — quienes reservan a través del portal público de un hotel o hacen check-in.</li>
              <li><strong>Visitantes de la landing page</strong> — quienes solo consultan hello-roomly.com.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">3. Datos que recabamos</h2>
            <p className="font-medium text-gray-800 mt-3">De hoteles y su equipo:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Nombre, correo electrónico y contraseña (gestionados por nuestro proveedor de autenticación, Clerk).</li>
              <li>Nombre del hotel, dirección, teléfono, logotipo y colores de marca.</li>
              <li>Datos de facturación y pago de tu suscripción (procesados por Stripe; Roomly no almacena números de tarjeta).</li>
            </ul>
            <p className="font-medium text-gray-800 mt-3">De huéspedes:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Nombre, correo electrónico y teléfono al hacer una reserva.</li>
              <li>Datos de pago de la reserva (procesados por Stripe).</li>
              <li>
                Al hacer check-in (en recepción o mediante pre-check-in en línea): tipo y número de
                documento de identidad (INE, pasaporte u otro), nacionalidad y, si aplica, placas del
                vehículo. Estos datos los solicita el hotel para cumplir con el registro de huéspedes
                que exige la normatividad turística mexicana.
              </li>
            </ul>
            <p className="font-medium text-gray-800 mt-3">De visitantes del sitio:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Datos técnicos básicos de navegación (dirección IP, tipo de dispositivo) con fines de seguridad y prevención de abuso.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">4. Para qué usamos tus datos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Operar el panel de reservas, calendario, pagos y reportes de cada hotel.</li>
              <li>Procesar reservas y pagos de huéspedes.</li>
              <li>Cumplir con el registro de huéspedes exigido por la normatividad turística aplicable.</li>
              <li>Enviar confirmaciones, recordatorios y notificaciones relacionadas con reservas.</li>
              <li>Facturar y cobrar la suscripción del hotel a Roomly.</li>
              <li>Prevenir fraude, abuso y garantizar la seguridad de la Plataforma.</li>
            </ul>
            <p className="mt-2">No vendemos ni rentamos tus datos personales a terceros.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">5. Con quién compartimos tus datos</h2>
            <p>Para operar Roomly usamos los siguientes proveedores, que procesan datos en nuestro nombre:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Stripe</strong> — procesamiento de pagos y suscripciones.</li>
              <li><strong>Clerk</strong> — autenticación e inicio de sesión.</li>
              <li><strong>Resend</strong> — envío de correos transaccionales (confirmaciones, recordatorios).</li>
              <li><strong>Supabase / infraestructura en la nube</strong> — almacenamiento de la base de datos.</li>
              <li><strong>Vercel</strong> — hospedaje de la aplicación.</li>
            </ul>
            <p className="mt-2">
              Cada hotel es responsable de los datos de sus propios huéspedes frente a ellos; Roomly
              actúa como encargado del tratamiento (proveedor de la herramienta) para esos datos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">6. Derechos ARCO</h2>
            <p>
              Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte (derechos ARCO) al tratamiento
              de tus datos personales, así como a revocar tu consentimiento. Para ejercerlos, escríbenos
              a{" "}
              <a href="mailto:contacto.roomly@gmail.com" className="text-blue-600 underline">
                contacto.roomly@gmail.com
              </a>{" "}
              indicando tu nombre, el dato sobre el que quieres ejercer tu derecho y una copia de una
              identificación que permita verificar tu identidad. Responderemos en un plazo razonable
              conforme a la ley aplicable.
            </p>
            <p className="mt-2">
              Si eres huésped de un hotel que usa Roomly, también puedes ejercer tus derechos
              directamente con ese hotel, ya que es el responsable primario de tus datos de reserva.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">7. Conservación de datos</h2>
            <p>
              Conservamos los datos mientras tu cuenta o la del hotel esté activa, y durante el tiempo
              adicional necesario para cumplir obligaciones fiscales, contables o legales.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">8. Cambios a este aviso</h2>
            <p>
              Podemos actualizar este aviso de privacidad. Si los cambios son significativos, te
              avisaremos por correo o mediante un aviso visible en la Plataforma.
            </p>
          </section>
        </div>

        <div className="mt-12 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
          Este aviso es una plantilla base y no sustituye una revisión legal. Si tu hotel maneja
          categorías adicionales de datos sensibles, consulta con un abogado antes de operar.
        </div>
      </div>
    </div>
  );
}
