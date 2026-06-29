import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { PrismaClient, ModalidadTarifa } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  const propiedad = await prisma.propiedad.upsert({
    where: { slug: "hotel-demo" },
    update: {},
    create: {
      clerkOrgId: "org_seed_demo",
      slug: "hotel-demo",
      nombre: "Hotel Demo",
      descripcion: "Hotel familiar de prueba en la Ciudad de México",
      colorPrimario: "#1a56db",
      telefono: "+52 55 1234 5678",
      email: "contacto@hoteldemo.mx",
      direccion: "Av. Reforma 123, CDMX",
    },
  });
  console.log(`✓ Propiedad: ${propiedad.slug}`);

  const tipoSencilla = await prisma.tipoDeHabitacion.upsert({
    where: { id: "tipo-sencilla-demo" },
    update: {},
    create: {
      id: "tipo-sencilla-demo",
      propiedadId: propiedad.id,
      nombre: "Habitación Sencilla",
      descripcion: "Habitación con cama individual, perfecta para viajero solo.",
      capacidadMin: 1,
      capacidadMax: 2,
      fotos: [],
      amenidades: ["WiFi", "TV", "Baño privado", "Aire acondicionado"],
      tarifaBasePrice: 800,
      tarifaBaseModalidad: ModalidadTarifa.POR_HABITACION,
    },
  });

  const tipoDoble = await prisma.tipoDeHabitacion.upsert({
    where: { id: "tipo-doble-demo" },
    update: {},
    create: {
      id: "tipo-doble-demo",
      propiedadId: propiedad.id,
      nombre: "Habitación Doble",
      descripcion: "Habitación con cama matrimonial, ideal para parejas.",
      capacidadMin: 1,
      capacidadMax: 3,
      fotos: [],
      amenidades: ["WiFi", "TV", "Baño privado", "Aire acondicionado", "Minibar"],
      tarifaBasePrice: 1200,
      tarifaBaseModalidad: ModalidadTarifa.POR_HABITACION,
    },
  });
  console.log(`✓ Tipos de habitación: Sencilla ($800), Doble ($1200)`);

  // Habitaciones físicas
  const habitacionesSencillas = ["101", "102", "103"];
  for (const numero of habitacionesSencillas) {
    await prisma.habitacion.upsert({
      where: { propiedadId_numero: { propiedadId: propiedad.id, numero } },
      update: {},
      create: {
        propiedadId: propiedad.id,
        tipoDeHabitacionId: tipoSencilla.id,
        numero,
      },
    });
  }

  const habitacionesDobles = ["201", "202", "203", "204"];
  for (const numero of habitacionesDobles) {
    await prisma.habitacion.upsert({
      where: { propiedadId_numero: { propiedadId: propiedad.id, numero } },
      update: {},
      create: {
        propiedadId: propiedad.id,
        tipoDeHabitacionId: tipoDoble.id,
        numero,
      },
    });
  }
  console.log(`✓ Habitaciones: 3 sencillas (101-103), 4 dobles (201-204)`);

  // Temporada alta: julio-agosto 2026
  await prisma.temporada.upsert({
    where: { id: "temp-alta-doble-2026" },
    update: {},
    create: {
      id: "temp-alta-doble-2026",
      propiedadId: propiedad.id,
      tipoDeHabitacionId: tipoDoble.id,
      nombre: "Temporada Alta Verano 2026",
      fechaInicio: new Date("2026-07-01"),
      fechaFin: new Date("2026-08-31"),
      precio: 1800,
      modalidad: ModalidadTarifa.POR_HABITACION,
    },
  });
  console.log(`✓ Temporada: Alta Verano 2026 (Doble $1800)`);

  console.log("\n✅ Seed completo.");
  console.log(`\n🌐 Portal: http://localhost:3000/p/hotel-demo`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
