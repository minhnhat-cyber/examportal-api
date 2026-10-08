import { withAuth } from "@/lib/auth";
import bcrypt from "bcrypt";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { serializeStudent, validateStudent } from "@/lib/student-validation";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

async function handleGET(request) {
  try { const { searchParams } = new URL(request.url); const search = searchParams.get("search")?.trim(); const status = searchParams.get("status")?.trim(); const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10)); const size = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("size") || "10", 10))); const filter = { role: "student" }; if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }]; if (status) filter.status = status; const client = await getClientPromise(); const collection = client.db(process.env.DB_NAME || "examportal").collection("users"); const [items, totalItems] = await Promise.all([collection.find(filter, { projection: { password: 0 } }).sort({ name: 1 }).skip((page - 1) * size).limit(size).toArray(), collection.countDocuments(filter)]); return successResponse({ items: items.map(serializeStudent), pagination: { page, size, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / size)) } }); }
  catch (error) { console.error("GET Students Exception", error); return errorResponse("Unable to load students.", 500); }
}

async function handlePOST(request) {
  try { const validation = validateStudent(await request.json(), true); if (validation.error) return errorResponse(validation.error, 400); const { password, ...profile } = validation.value; const now = new Date(); const document = { ...profile, password: await bcrypt.hash(password, 12), role: "student", createdAt: now, updatedAt: now }; const client = await getClientPromise(); const result = await client.db(process.env.DB_NAME || "examportal").collection("users").insertOne(document); return successResponse(serializeStudent({ ...document, _id: result.insertedId }), 201); }
  catch (error) { if (error?.code === 11000) return errorResponse("Email already exists.", 409); console.error("POST Student Exception", error); return errorResponse("Unable to create the student.", 500); }
}

export const GET = withAuth("teacher", handleGET);
export const POST = withAuth("teacher", handlePOST);

