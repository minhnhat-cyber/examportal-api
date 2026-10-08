import { withAuth } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { serializeExam, validateExam } from "@/lib/exam-validation";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const size = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("size") || "10", 10)));
    const filter = {};
    if (search) filter.$or = [{ code: { $regex: search, $options: "i" } }, { title: { $regex: search, $options: "i" } }, { subject: { $regex: search, $options: "i" } }];
    if (status) filter.status = status;
    const client = await getClientPromise();
    const collection = client.db(process.env.DB_NAME || "examportal").collection("exams");
    const [items, totalItems] = await Promise.all([collection.find(filter).sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).toArray(), collection.countDocuments(filter)]);
    return successResponse({ items: items.map(serializeExam), pagination: { page, size, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / size)) } });
  } catch (error) { console.error("GET Exams Exception", error); return errorResponse("Unable to load exams.", 500); }
}

async function handlePOST(request) {
  try {
    const validation = validateExam(await request.json());
    if (validation.error) return errorResponse(validation.error, 400);
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "examportal");
    const questionCount = await db.collection("questions").countDocuments({ _id: { $in: validation.value.questionIds } });
    if (questionCount !== validation.value.questionIds.length) return errorResponse("One or more selected questions do not exist.", 400);
    const now = new Date();
    const document = { ...validation.value, attemptCount: 0, studentCount: await db.collection("users").countDocuments({ role: "student", status: "active" }), createdAt: now, updatedAt: now };
    const result = await db.collection("exams").insertOne(document);
    return successResponse(serializeExam({ ...document, _id: result.insertedId }), 201);
  } catch (error) {
    if (error?.code === 11000) return errorResponse("Exam code already exists.", 409);
    console.error("POST Exam Exception", error); return errorResponse("Unable to create the exam.", 500);
  }
}

export const GET = withAuth("teacher", handleGET);
export const POST = withAuth("teacher", handlePOST);

