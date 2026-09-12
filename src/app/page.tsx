import PacmanGame from "@/components/pacman/PacmanGame";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black p-6">
      <h1 className="text-3xl font-bold tracking-widest text-yellow-400">吃豆人</h1>
      <PacmanGame />
    </main>
  );
}
