import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { serializeStudent, validateStudent } from "@/lib/student-validation";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
const toId = (value) => ObjectId.isValid(value) ? new ObjectId(value) : null;

export async function GET(_request, { params }) { try { const { student_id } = await params; const _id = toId(student_id); if (!_id) return errorResponse("Invalid student ID.", 400); const client = await getClientPromise(); const user = await client.db(process.env.DB_NAME || "examportal").collection("users").findOne({ _id, role: "student" }, { projection: { password: 0 } }); return user ? successResponse(serializeStudent(user)) : errorResponse("Student not found.", 404); } catch (error) { console.error("GET Student Exception", error); return errorResponse("Unable to load the student.", 500); } }

export async function PUT(request, { params }) {
  try { const { student_id } = await params; const _id = toId(student_id); if (!_id) return errorResponse("Invalid student ID.", 400); const input = await request.json(); const validation = validateStudent(input); if (validation.error) return errorResponse(validation.error, 400); const { password, ...profile } = validation.value; const changes = { ...profile, updatedAt: new Date() }; if (password) { if (password.length < 8) return errorResponse("Password must contain at least 8 characters.", 400); changes.password = await bcrypt.hash(password, 12); } const client = await getClientPromise(); const updated = await client.db(process.env.DB_NAME || "examportal").collection("users").findOneAndUpdate({ _id, role: "student" }, { $set: changes }, { returnDocument: "after", projection: { password: 0 } }); return updated ? successResponse(serializeStudent(updated)) : errorResponse("Student not found.", 404); }
  catch (error) { if (error?.code === 11000) return errorResponse("Email already exists.", 409); console.error("PUT Student Exception", error); return errorResponse("Unable to update the student.", 500); }
}

export async function DELETE(_request, { params }) { try { const { student_id } = await params; const _id = toId(student_id); if (!_id) return errorResponse("Invalid student ID.", 400); const client = await getClientPromise(); const db = client.db(process.env.DB_NAME || "examportal"); if (await db.collection("attempts").findOne({ studentId: _id })) return errorResponse("A student with attempts cannot be deleted. Set the account to inactive instead.", 409); const result = await db.collection("users").deleteOne({ _id, role: "student" }); return result.deletedCount ? successResponse({ message: "Student deleted." }) : errorResponse("Student not found.", 404); } catch (error) { console.error("DELETE Student Exception", error); return errorResponse("Unable to delete the student.", 500); } }
