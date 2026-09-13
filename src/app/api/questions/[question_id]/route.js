import { ObjectId } from "mongodb";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { serializeQuestion, validateQuestion } from "@/lib/question-validation";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function questionId(params) {
  return ObjectId.isValid(params.question_id) ? new ObjectId(params.question_id) : null;
}

export async function GET(_request, { params }) {
  try {
    const resolvedParams = await params;
    const _id = questionId(resolvedParams);
    if (!_id) return errorResponse("Invalid question ID.", 400);
    const client = await getClientPromise();
    const question = await client.db(process.env.DB_NAME || "examportal").collection("questions").findOne({ _id });
    return question ? successResponse(serializeQuestion(question)) : errorResponse("Question not found.", 404);
  } catch (error) {
    console.error("GET Question Exception", error);
    return errorResponse("Unable to load the question.", 500);
  }
}

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const _id = questionId(resolvedParams);
    if (!_id) return errorResponse("Invalid question ID.", 400);
    const validation = validateQuestion(await request.json());
    if (validation.error) return errorResponse(validation.error, 400);
    const client = await getClientPromise();
    const collection = client.db(process.env.DB_NAME || "examportal").collection("questions");
    const updated = await collection.findOneAndUpdate({ _id }, { $set: { ...validation.value, updatedAt: new Date() } }, { returnDocument: "after" });
    return updated ? successResponse(serializeQuestion(updated)) : errorResponse("Question not found.", 404);
  } catch (error) {
    if (error?.code === 11000) return errorResponse("Question code already exists.", 409);
    console.error("PUT Question Exception", error);
    return errorResponse("Unable to update the question.", 500);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const resolvedParams = await params;
    const _id = questionId(resolvedParams);
    if (!_id) return errorResponse("Invalid question ID.", 400);
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "examportal");
    const usedByExam = await db.collection("exams").findOne({ questionIds: _id });
    if (usedByExam) return errorResponse("This question is used by an exam and cannot be deleted.", 409);
    const result = await db.collection("questions").deleteOne({ _id });
    return result.deletedCount ? successResponse({ message: "Question deleted." }) : errorResponse("Question not found.", 404);
  } catch (error) {
    console.error("DELETE Question Exception", error);
    return errorResponse("Unable to delete the question.", 500);
  }
}
