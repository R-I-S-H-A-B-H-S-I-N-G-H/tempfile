import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import mediaRouter from "./routes/media.ts";

const app = new Hono();

// Enable CORS for frontend clients
app.use("/*", cors());

app.route("/", mediaRouter);

export default app;
