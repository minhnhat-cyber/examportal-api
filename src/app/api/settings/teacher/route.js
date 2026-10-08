import { withAuth, currentUser } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
const serialize = (user) => ({ id: user._id.toString(), name: user.name, email: user.email, role: user.role, status: user.status });

async function handleGET(request) { try { const client = await getClientPromise(); const user = await client.db(process.env.DB_NAME || "examportal").collection("users").findOne({ _id: (await currentUser(request))._id, role: "teacher" }); return user ? successResponse(serialize(user)) : errorResponse("Teacher not found.", 404); } catch (error) { console.error("GET Teacher Settings Exception", error); return errorResponse("Unable to load settings.", 500); } }
async function handlePUT(request) { try { const input = await request.json(); const name = String(input.name || "").trim(); if (!name) return errorResponse("Name is required.", 400); const client = await getClientPromise(); const user = await client.db(process.env.DB_NAME || "examportal").collection("users").findOneAndUpdate({ _id: (await currentUser(request))._id, role: "teacher" }, { $set: { name, updatedAt: new Date() } }, { returnDocument: "after" }); return user ? successResponse(serialize(user)) : errorResponse("Teacher not found.", 404); } catch (error) { console.error("PUT Teacher Settings Exception", error); return errorResponse("Unable to update settings.", 500); } }

export const GET = withAuth("teacher", handleGET);
export const PUT = withAuth("teacher", handlePUT);


