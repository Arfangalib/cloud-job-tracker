import { createApp } from "./server.js";
import { connectDb } from "./db.js";
import { env } from "./config/env.js";

await connectDb();

const app = createApp();

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
