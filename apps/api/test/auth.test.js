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
}, 60000);

afterAll(async () => {
  await disconnectDb();
  if (mongo) await mongo.stop();
});

describe("auth security", () => {
  it("returns validation details for short registration passwords", async () => {
    const response = await request(app).post("/auth/register").send({
      name: "Cloud Student",
      email: "short-password@example.com",
      password: "short"
    });

    expect(response.status).toBe(400);
    expect(Array.isArray(response.body.error)).toBe(true);
    expect(response.body.error[0].message).toContain("at least 10 character");
  });

  it("returns validation details for invalid login email", async () => {
    const response = await request(app).post("/auth/login").send({
      email: "not-an-email",
      password: "verysecurepassword"
    });

    expect(response.status).toBe(400);
    expect(Array.isArray(response.body.error)).toBe(true);
    expect(response.body.error[0].path).toContain("email");
  });

  it("registers, stores hashed refresh tokens, rotates refresh tokens, and revokes logout", async () => {
    const register = await request(app).post("/auth/register").send({
      name: "Cloud Student",
      email: "student@example.com",
      password: "verysecurepassword"
    });

    expect(register.status).toBe(201);
    expect(register.body.accessToken).toBeTruthy();
    expect(register.headers["set-cookie"].join(";")).toContain("HttpOnly");
    expect(register.headers["set-cookie"].join(";")).toContain("SameSite=Strict");

    const session = await Session.findOne();
    expect(session.tokenHash).toHaveLength(64);

    const refresh = await request(app).post("/auth/refresh").set("Cookie", register.headers["set-cookie"]);
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();

    const logout = await request(app).post("/auth/logout").set("Cookie", refresh.headers["set-cookie"]);
    expect(logout.status).toBe(204);
    const clearCookie = logout.headers["set-cookie"].join(";");
    expect(clearCookie).toContain("Path=/auth");
    expect(clearCookie).toContain("SameSite=Strict");

    const oldReuse = await request(app).post("/auth/refresh").set("Cookie", register.headers["set-cookie"]);
    expect(oldReuse.status).toBe(401);
  });
});
