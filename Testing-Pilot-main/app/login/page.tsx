import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; pending?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="space-y-6 py-10">
      {params.registered ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-sm">
          Registration submitted. Your account needs admin approval before login.
        </div>
      ) : null}
      {params.pending ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700 shadow-sm">
          Your account is still waiting for admin approval.
        </div>
      ) : null}
      <AuthForm mode="login" />
    </main>
  );
}
