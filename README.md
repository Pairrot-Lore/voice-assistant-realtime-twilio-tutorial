# Twilio <> OpenAI Realtime Voice Assistant

Minimal Node server that connects a Twilio Voice `<Stream>` to OpenAI's Realtime GPT through the official OpenAI Agents SDK for JavaScript (`openai/openai-agents-js`). The assistant is configured as a friendly support agent with no tool calls.

## Prereqs
- Node 22+ (per openai/openai-agents-js)
- Twilio Voice number (with Programmable Voice enabled)
- Publicly reachable HTTPS/WSS URL (ngrok, Cloudflare tunnel, etc.)
- OpenAI API key with access to a realtime-capable model (default: `gpt-realtime`)

## Setup
1. Copy environment template:
   ```bash
   cp .env.example .env
   # fill in OPENAI_API_KEY, Twilio SIDs, and expose your server with ngrok
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the server (TypeScript via tsx):
   ```bash
   npm run start
   ```

## Twilio wiring
1. Expose the server publicly (ngrok example):
   ```bash
   ngrok http 3000
   ```
   Set `PUBLIC_BASE_URL` to the `https://` URL ngrok gives you.
2. Point your Twilio phone number's Voice webhook to `POST {PUBLIC_BASE_URL}/incoming-call`.
3. Twilio will call `/incoming-call`, receive TwiML that opens a `<Stream>` to `wss://${request.headers.host}/media-stream`, and start piping mulaw audio both ways.

## How it works
- `src/server.ts` (Fastify + TypeScript) exposes `/incoming-call` (TwiML) and upgrades `/media-stream` WebSocket connections. The stream URL is built from the inbound `Host` header (`wss://${host}/media-stream`) like the reference example.
- `TwilioRealtimeTransportLayer` handles the media wiring and encoding for the Twilio stream.
- `RealtimeAgent` is configured as a concise, friendly support persona with no tools.
- `RealtimeSession` is configured for mulaw 8kHz audio I/O and the `alloy` voice, streaming responses back to the caller automatically.
- Tool calls are disabled; only conversational support responses are generated.

## Notes and tuning
- If you prefer a different voice or model, tweak `OPENAI_MODEL` and the `voice` in `session.update`.
- To add logging/observability, attach handlers in `TwilioRealtimeBridge` for `start/stop` events.
- Twilio streaming uses PCMU (mulaw) audio; the Realtime session is configured to mirror that format for low-latency round-trips.

## Testing
With the server running and your Twilio number pointed at `/voice`, place a call to hear the realtime assistant respond. If audio flows only one way, confirm:
- `PUBLIC_BASE_URL` resolves over HTTPS/WSS.
- Your OpenAI key has Realtime access.
- The tunnel isn't stripping WebSocket upgrade headers.
