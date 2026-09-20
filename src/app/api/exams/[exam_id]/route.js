import { ObjectId } from "mongodb";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { serializeExam, validateExam } from "@/lib/exam-validation";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
const toId = (value) => ObjectId.isValid(value) ? new ObjectId(value) : null;

export async function GET(_request, { params }) {
  try { const { exam_id } = await params; const _id = toId(exam_id); if (!_id) return errorResponse("Invalid exam ID.", 400); const client = await getClientPromise(); const exam = await client.db(process.env.DB_NAME || "examportal").collection("exams").findOne({ _id }); return exam ? successResponse(serializeExam(exam)) : errorResponse("Exam not found.", 404); }
  catch (error) { console.error("GET Exam Exception", error); return errorResponse("Unable to load the exam.", 500); }
}

export async function PUT(request, { params }) {
  try {
    const { exam_id } = await params; const _id = toId(exam_id); if (!_id) return errorResponse("Invalid exam ID.", 400);
    const validation = validateExam(await request.json()); if (validation.error) return errorResponse(validation.error, 400);
    const client = await getClientPromise(); const db = client.db(process.env.DB_NAME || "examportal");
    const questionCount = await db.collection("questions").countDocuments({ _id: { $in: validation.value.questionIds } });
    if (questionCount !== validation.value.questionIds.length) return errorResponse("One or more selected questions do not exist.", 400);
    const updated = await db.collection("exams").findOneAndUpdate({ _id }, { $set: { ...validation.value, updatedAt: new Date() } }, { returnDocument: "after" });
    return updated ? successResponse(serializeExam(updated)) : errorResponse("Exam not found.", 404);
  } catch (error) { if (error?.code === 11000) return errorResponse("Exam code already exists.", 409); console.error("PUT Exam Exception", error); return errorResponse("Unable to update the exam.", 500); }
}

export async function DELETE(_request, { params }) {
  try {
    const { exam_id } = await params; const _id = toId(exam_id); if (!_id) return errorResponse("Invalid exam ID.", 400);
    const client = await getClientPromise(); const db = client.db(process.env.DB_NAME || "examportal");
    if (await db.collection("attempts").findOne({ examId: _id })) return errorResponse("An exam with attempts cannot be deleted.", 409);
    const result = await db.collection("exams").deleteOne({ _id });
    return result.deletedCount ? successResponse({ message: "Exam deleted." }) : errorResponse("Exam not found.", 404);
  } catch (error) { console.error("DELETE Exam Exception", error); return errorResponse("Unable to delete the exam.", 500); }
}
