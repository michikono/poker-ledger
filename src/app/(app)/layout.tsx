import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/auth/admin";
import SignOutButton from "./sign-out-button";

async function getSessionUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    const displayName = decoded.name ?? decoded.email ?? "User";
    const firstName = displayName.split(" ")[0] ?? displayName;
    return { uid: decoded.uid, firstName };
  } catch {
    return null;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  return (
    <>
      <header
        style={{
          padding: "1rem",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Poker Ledger</span>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <span>{user.firstName}</span>
          <SignOutButton />
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
