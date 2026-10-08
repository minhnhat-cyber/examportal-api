import bcrypt from "bcrypt";
import corsHeaders from "@/lib/cors";
import { database, hashToken, newSession, originAllowed, serializeUser, sessionCookie } from "@/lib/auth";
export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
export async function POST(request) {
  const reply = (message, status) => Response.json({ message }, { status, headers: corsHeaders });
  if (!originAllowed(request)) return reply("Invalid request origin.", 403);
  try {
    const input = await request.json();
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    if (!email || email.length > 254 || !password || Buffer.byteLength(password) > 72) return reply("Invalid email or password.", 401);
    const db = await database();
    const limits = db.collection("loginLimits");
    await limits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    const limit = await limits.findOneAndUpdate({ _id: hashToken(`${email}:${Math.floor(Date.now() / 900000)}`) }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 900000) } }, { upsert: true, returnDocument: "after" });
    if (limit.count > 15) return reply("Too many attempts. Please try again in 15 minutes.", 429);
    const user = await db.collection("users").findOne({ email, status: "active", role: { $in: ["teacher", "student"] } });
    const valid = await bcrypt.compare(password, user?.password || "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy");
    if (!user || !valid) return reply("Invalid email or password.", 401);
    const token = await newSession(db, user);
    return Response.json(serializeUser(user), { headers: { ...corsHeaders, "Set-Cookie": sessionCookie(token), "Cache-Control": "no-store" } });
  } catch { return reply("Unable to sign in. Please try again.", 503); }
}
