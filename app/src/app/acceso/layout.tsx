import { ClerkProvider } from "@clerk/nextjs";

export default function AccesoLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
