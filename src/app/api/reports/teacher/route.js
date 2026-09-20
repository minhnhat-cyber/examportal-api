import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

export async function GET() {
  try {
    const client = await getClientPromise(); const db = client.db(process.env.DB_NAME || "examportal");
    const [summary, byExam] = await Promise.all([
      db.collection("attempts").aggregate([{ $match: { status: "submitted" } }, { $group: { _id: null, averageScore: { $avg: "$percentage" }, highestScore: { $max: "$percentage" }, lowestScore: { $min: "$percentage" }, submittedAttempts: { $sum: 1 } } }]).next(),
      db.collection("attempts").aggregate([{ $match: { status: "submitted" } }, { $group: { _id: "$examId", averageScore: { $avg: "$percentage" }, attempts: { $sum: 1 }, passCount: { $sum: { $cond: [{ $gte: ["$percentage", 50] }, 1, 0] } } } }, { $lookup: { from: "exams", localField: "_id", foreignField: "_id", as: "exam" } }, { $unwind: "$exam" }, { $project: { _id: 0, examId: { $toString: "$_id" }, code: "$exam.code", title: "$exam.title", attempts: 1, averageScore: { $round: ["$averageScore", 1] }, passRate: { $round: [{ $multiply: [{ $divide: ["$passCount", "$attempts"] }, 100] }, 1] } } }, { $sort: { attempts: -1 } }]).toArray(),
    ]);
    return successResponse({ summary: { averageScore: Number((summary?.averageScore || 0).toFixed(1)), highestScore: summary?.highestScore || 0, lowestScore: summary?.lowestScore || 0, submittedAttempts: summary?.submittedAttempts || 0 }, byExam });
  } catch (error) { console.error("GET Teacher Report Exception", error); return errorResponse("Unable to load report.", 500); }
}
