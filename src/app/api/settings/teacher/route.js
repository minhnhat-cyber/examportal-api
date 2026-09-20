import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
const email = "teacher@examportal.local";
const serialize = (user) => ({ id: user._id.toString(), name: user.name, email: user.email, role: user.role, status: user.status });

export async function GET() { try { const client = await getClientPromise(); const user = await client.db(process.env.DB_NAME || "examportal").collection("users").findOne({ email, role: "teacher" }); return user ? successResponse(serialize(user)) : errorResponse("Teacher not found.", 404); } catch (error) { console.error("GET Teacher Settings Exception", error); return errorResponse("Unable to load settings.", 500); } }
export async function PUT(request) { try { const input = await request.json(); const name = String(input.name || "").trim(); if (!name) return errorResponse("Name is required.", 400); const client = await getClientPromise(); const user = await client.db(process.env.DB_NAME || "examportal").collection("users").findOneAndUpdate({ email, role: "teacher" }, { $set: { name, updatedAt: new Date() } }, { returnDocument: "after" }); return user ? successResponse(serialize(user)) : errorResponse("Teacher not found.", 404); } catch (error) { console.error("PUT Teacher Settings Exception", error); return errorResponse("Unable to update settings.", 500); } }
