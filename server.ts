import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { registerRoomManager } from "./src/server/room-manager";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

async function bootstrap() {
  const app = next({
    dev,
    hostname,
    port
  });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((request, response) => {
    void handle(request, response);
  });

  const io = new Server(httpServer, {
    path: "/socket.io"
  });

  registerRoomManager(io);

  httpServer.listen(port, hostname, () => {
    process.stdout.write(`> Ready on http://${hostname}:${port}\n`);
  });
}

bootstrap().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
