import "jsr:@std/dotenv/load";
import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.12.0";
import app from "./app.ts";

const port = parseInt(Deno.env.get("PORT") || "8080");

// @ts-ignore: BunnySDK listener internals
const listener = BunnySDK.net.tcp.unstable_new();
// @ts-ignore: Patch the port for local development
if (listener && listener.addr && listener.addr.port) {
  // @ts-ignore
  listener.addr.port = port;
}

console.log("Listening on: 127.0.0.1:" + port);

// @ts-ignore
BunnySDK.net.http.serve(
  listener,
  (req: Request): Response | Promise<Response> => {
    console.log(`[INFO]: ${req.method} - ${req.url}`);
    return app.fetch(req);
  },
);
