import { createHash, randomBytes } from "node:crypto";
import { getClientPromise } from "./mongodb.js";
import corsHeaders from "./cors.js";
export const hashToken = token => createHash("sha256").update(token).digest("hex");
export const tokenFrom = request => request.headers.get("cookie")?.match(/(?:^|;\s*)examportal_session=([a-f0-9]{64})(?:;|$)/)?.[1];
export const database = async () => (await getClientPromise()).db(process.env.DB_NAME || "examportal");
export const serializeUser = user => ({ id: user._id.toString(), name: user.name, email: user.email, role: user.role });
export async function currentUser(request, db) {
  const token = tokenFrom(request);
  if (!token) return null;
  db ||= await database();
  const session = await db.collection("sessions").findOne({ _id: hashToken(token), expiresAt: { $gt: new Date() } });
  return session ? db.collection("users").findOne({ _id: session.userId, status: "active" }) : null;
}
export const sessionCookie = (token = "", age = 28800) => `examportal_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
export const originAllowed = request => !request.headers.get("origin") || request.headers.get("origin") === (process.env.FRONTEND_URL || "http://localhost:5173");
export async function newSession(db, user) {
  await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const token = randomBytes(32).toString("hex");
  await db.collection("sessions").insertOne({ _id: hashToken(token), userId: user._id, expiresAt: new Date(Date.now() + 28800000) });
  return token;
}
export function withAuth(role, handler) {
  return async (request, context) => {
    try {
      if (!["GET", "HEAD"].includes(request.method) && !originAllowed(request)) return Response.json({ message: "Invalid request origin." }, { status: 403, headers: corsHeaders });
      const user = await currentUser(request);
      if (!user) return Response.json({ message: "Please sign in." }, { status: 401, headers: corsHeaders });
      if (user.role !== role) return Response.json({ message: "Access denied." }, { status: 403, headers: corsHeaders });
      const response = await handler(request, context);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch { return Response.json({ message: "Service unavailable. Please try again." }, { status: 503, headers: corsHeaders }); }
  };
}
