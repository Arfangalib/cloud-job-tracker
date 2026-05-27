import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDb, disconnectDb } from "../src/db.js";
import { createApp } from "../src/server.js";
import { Session } from "../src/models/Session.js";

let mongo;
let app;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
  app = createApp();
});

afterAll(async () => {
  await disconnectDb();
  await mongo.stop();
});

describe("auth security", () => {
  it("registers, stores hashed refresh tokens, rotates refresh tokens, and revokes logout", async () => {
    const register = await request(app).post("/auth/register").send({
      name: "Cloud Student",
      email: "student@example.com",
      password: "verysecurepassword"
    });

    expect(register.status).toBe(201);
    expect(register.body.accessToken).toBeTruthy();
    expect(register.headers["set-cookie"].join(";")).toContain("HttpOnly");

    const session = await Session.findOne();
    expect(session.tokenHash).toHaveLength(64);

    const refresh = await request(app).post("/auth/refresh").set("Cookie", register.headers["set-cookie"]);
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();

    const oldReuse = await request(app).post("/auth/refresh").set("Cookie", register.headers["set-cookie"]);
    expect(oldReuse.status).toBe(401);
  });
});
