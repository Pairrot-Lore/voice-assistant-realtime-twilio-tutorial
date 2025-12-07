import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import {
  RealtimeAgent,
  RealtimeSession,
} from "@openai/agents-realtime";
import { TwilioRealtimeTransportLayer } from "@openai/agents-extensions";
import process from "node:process";

dotenv.config();

const { OPENAI_API_KEY, PORT = "3000" } = process.env;

if (!OPENAI_API_KEY) {
  // eslint-disable-next-line no-console
  console.error("Missing OpenAI API key. Please set it in the .env file.");
  process.exit(1);
}

const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

const agent = new RealtimeAgent({
  name: "Pairrot Support",
  instructions:
    "You are a warm, concise phone support assistant. "
    + "Listen carefully, acknowledge the caller's need, provide short helpful answers, "
    + "and do not request or perform tool calls.",
  tools: [],
});

fastify.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
  reply.send({ message: "Twilio Media Stream Server is running!" });
});

fastify.all(
  "/incoming-call",
  async (request: FastifyRequest, reply: FastifyReply) => {
    const host = request.headers.host;
    const streamUrl = host ? `wss://${host}/media-stream` : "";
    const twimlResponse = `
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${streamUrl}" />
    </Connect>
</Response>`.trim();

    reply.type("text/xml").send(twimlResponse);
  },
);

// Alias for setups still pointing at /voice
fastify.all(
  "/voice",
  async (request: FastifyRequest, reply: FastifyReply) => {
    const host = request.headers.host;
    const streamUrl = host ? `wss://${host}/media-stream` : "";
    const twimlResponse = `
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Hi there! You're connected to our support assistant. You can start talking now.</Say>
    <Connect>
        <Stream url="${streamUrl}" />
    </Connect>
</Response>`.trim();

    reply.type("text/xml").send(twimlResponse);
  },
);

fastify.register(async (scopedFastify: FastifyInstance) => {
  scopedFastify.get(
    "/media-stream",
    { websocket: true },
    async (connection) => {
      // eslint-disable-next-line no-console
      console.log("[media-stream] websocket connected");

      const twilioTransportLayer = new TwilioRealtimeTransportLayer({
        twilioWebSocket: connection,
      });

      const session = new RealtimeSession(agent, {
        transport: twilioTransportLayer,
        model: "gpt-realtime",
        config: {
          audio: {
            input: { format: "mulaw-8000" },
            output: {
              format: "mulaw-8000",
              voice: "alloy",
            },
          },
          // Twilio transport expects audio replies; keep modalities to audio-only per API constraints.
          modalities: ["audio"],
        },
      });

      session.on("error", (error: unknown) => {
        // eslint-disable-next-line no-console
        console.error("[realtime session] error", error);
      });
      session.on("close", (event: { code?: number; reason?: string }) => {
        // eslint-disable-next-line no-console
        console.log("[realtime session] closed", event?.code, event?.reason);
      });

      await session.connect({
        apiKey: OPENAI_API_KEY,
      });
      // eslint-disable-next-line no-console
      console.log("Connected to the OpenAI Realtime API");
    },
  );
});

fastify.listen({ port: Number(PORT), host: "0.0.0.0" }, (err: Error | null) => {
  if (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`Server is listening on port ${PORT}`);
});

process.on("SIGINT", () => {
  void fastify.close();
  process.exit(0);
});
