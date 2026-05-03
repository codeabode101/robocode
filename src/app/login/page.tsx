import { redirect } from "next/navigation";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <a
        href="/auth/login"
        className="rounded bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
      >
        Sign in with WorkOS
      </a>
    </div>
  );
}
