import GameLauncher from "../components/GameLauncher";

type GamePageProps = {
  searchParams: Promise<{
    autostart?: string | string[];
  }>;
};

export default async function GamePage({ searchParams }: GamePageProps) {
  const params = await searchParams;
  const autoStart = params.autostart === "1";

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Play</h1>
      <GameLauncher autoStart={autoStart} />
    </main>
  );
}