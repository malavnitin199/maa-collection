import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">Maa Collection</h1>
      <p className="text-zinc-500 dark:text-zinc-400">
        Retail inventory and point-of-sale application.
      </p>
      <Link
        href="/login"
        className="w-fit rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
      >
        Get started
      </Link>
    </main>
  );
}
