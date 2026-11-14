import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Maa Collection</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose a profile to continue. Demo only — real sign-in arrives in Phase P2.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Link
          href="/pos"
          className="rounded-xl bg-emerald-600 px-5 py-4 text-center text-lg font-medium text-white hover:bg-emerald-700"
        >
          Continue as Salesman
          <span className="block text-sm font-normal text-emerald-100">
            Scan items, record sales
          </span>
        </Link>
        <Link
          href="/admin/dashboard"
          className="rounded-xl bg-zinc-800 px-5 py-4 text-center text-lg font-medium text-white hover:bg-zinc-900 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
        >
          Continue as Admin
          <span className="block text-sm font-normal opacity-70">
            Stock, sales and reports
          </span>
        </Link>
      </div>
    </main>
  );
}
