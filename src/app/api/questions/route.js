import { withAuth } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { serializeQuestion, validateQuestion } from "@/lib/question-validation";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const topic = searchParams.get("topic")?.trim();
    const difficulty = searchParams.get("difficulty")?.trim().toLowerCase();
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const size = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("size") || "10", 10)));
    const filter = {};
    if (search) filter.$or = [{ code: { $regex: search, $options: "i" } }, { text: { $regex: search, $options: "i" } }];
    if (topic) filter.topic = topic;
    if (difficulty) filter.difficulty = difficulty;

    const client = await getClientPromise();
    const collection = client.db(process.env.DB_NAME || "examportal").collection("questions");
    const [items, totalItems] = await Promise.all([
      collection.find(filter).sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).toArray(),
      collection.countDocuments(filter),
    ]);
    return successResponse({ items: items.map(serializeQuestion), pagination: { page, size, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / size)) } });
  } catch (error) {
    console.error("GET Questions Exception", error);
    return errorResponse("Unable to load questions.", 500);
  }
}

async function handlePOST(request) {
  try {
    const validation = validateQuestion(await request.json());
    if (validation.error) return errorResponse(validation.error, 400);
    const now = new Date();
    const document = { ...validation.value, status: "active", createdAt: now, updatedAt: now };
    const client = await getClientPromise();
    const collection = client.db(process.env.DB_NAME || "examportal").collection("questions");
    const result = await collection.insertOne(document);
    return successResponse(serializeQuestion({ ...document, _id: result.insertedId }), 201);
  } catch (error) {
    if (error?.code === 11000) return errorResponse("Question code already exists.", 409);
    console.error("POST Question Exception", error);
    return errorResponse("Unable to create the question.", 500);
  }
}

export const GET = withAuth("teacher", handleGET);
export const POST = withAuth("teacher", handlePOST);

