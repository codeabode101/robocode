import { DurableObject } from "cloudflare:workers";

interface Player {
  id: string;
  x: number;
  y: number;
  name?: string;
  ws?: WebSocket;
}

export class MultiplayerDO extends DurableObject {
  private players: Map<string, Player> = new Map();
  private broadcastInterval: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/multiplayer") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      await this.handleSession(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async handleSession(ws: WebSocket) {
    const playerId = crypto.randomUUID();
    const player: Player = {
      id: playerId,
      x: 0,
      y: 0,
      ws,
    };

    this.players.set(playerId, player);

    ws.accept();

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data as string);

        if (data.type === "move") {
          const p = this.players.get(playerId);
          if (p) {
            p.x = data.x;
            p.y = data.y;
          }
        } else if (data.type === "join") {
          const p = this.players.get(playerId);
          if (p) {
            p.name = data.name;
          }
          ws.send(JSON.stringify({ type: "init", playerId }));
        }
      } catch (e) {
        console.error("Error parsing message:", e);
      }
    });

    ws.addEventListener("close", () => {
      this.players.delete(playerId);
      this.broadcast({ type: "leave", playerId });
    });

    ws.addEventListener("error", () => {
      this.players.delete(playerId);
    });

    if (!this.broadcastInterval) {
      this.broadcastInterval = setInterval(() => this.broadcastState(), 100);
    }

    ws.send(JSON.stringify({ type: "init", playerId }));
  }

  broadcastState() {
    const players = Array.from(this.players.entries()).map(([id, p]) => ({
      id,
      x: p.x,
      y: p.y,
      name: p.name,
    }));

    this.broadcast({ type: "state", players });
  }

  broadcast(message: any) {
    const msg = JSON.stringify(message);
    this.players.forEach((player) => {
      try {
        player.ws?.send(msg);
      } catch (e) {
        console.error("Error broadcasting:", e);
      }
    });
  }
}

interface Env {
  MULTIPLAYER_DO: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/multiplayer") {
      const id = env.MULTIPLAYER_DO.idFromName("global");
      const stub = env.MULTIPLAYER_DO.get(id);
      return stub.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
