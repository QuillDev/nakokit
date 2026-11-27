import process from "node:process";

const server = Bun.spawn(["bun", "--watch", "server/main.ts"], {
  stdio: ["inherit", "inherit", "inherit"],
});

const web = Bun.spawn(["bun", "run", "dev:web"], {
  stdio: ["inherit", "inherit", "inherit"],
});

function shutdown() {
  server.kill();
  web.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const exitCode = await Promise.race([server.exited, web.exited]);
shutdown();
process.exit(exitCode);
