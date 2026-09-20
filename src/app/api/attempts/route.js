import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const search = searchParams.get("search")?.trim().toLowerCase();
    const client = await getClientPromise(); const db = client.db(process.env.DB_NAME || "examportal");
    const match = status ? { status } : {};
    let items = await db.collection("attempts").aggregate([
      { $match: match },
      { $lookup: { from: "users", localField: "studentId", foreignField: "_id", as: "student" } },
      { $lookup: { from: "exams", localField: "examId", foreignField: "_id", as: "exam" } },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$exam", preserveNullAndEmptyArrays: true } },
      { $sort: { startedAt: -1 } }, { $limit: 100 },
      { $project: { _id: 1, attemptNumber: 1, score: 1, totalPoints: 1, percentage: 1, status: 1, startedAt: 1, submittedAt: 1, studentName: "$student.name", studentEmail: "$student.email", examTitle: "$exam.title", examCode: "$exam.code" } },
    ]).toArray();
    if (search) items = items.filter((item) => `${item.studentName} ${item.studentEmail} ${item.examTitle} ${item.examCode}`.toLowerCase().includes(search));
    return successResponse({ items: items.map((item) => ({ ...item, id: item._id.toString(), _id: undefined })) });
  } catch (error) { console.error("GET Attempts Exception", error); return errorResponse("Unable to load attempts.", 500); }
}
