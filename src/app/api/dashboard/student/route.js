import { withAuth } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { getCurrentStudent } from "@/lib/current-user";
import { expireIfElapsed } from "@/lib/grading";
import { serializeAttemptSummary } from "@/lib/student-serializers";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

/** Headline numbers and shortcuts for the student landing page. */
async function handleGET(request) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "examportal");

    const student = await getCurrentStudent(request, db);
    if (!student) return errorResponse("No active student account was found.", 401);

    const now = new Date();
    const [openExams, raw] = await Promise.all([
      db.collection("exams").countDocuments({ status: "active", opensAt: { $lte: now }, closesAt: { $gte: now } }),
      db.collection("attempts").find({ studentId: student._id }).sort({ startedAt: -1 }).toArray(),
    ]);

    const attempts = await Promise.all(raw.map((attempt) => expireIfElapsed(db, attempt, now)));
    const submitted = attempts.filter((attempt) => attempt.status === "submitted");
    const running = attempts.find((attempt) => attempt.status === "in_progress");

    const averageScore = submitted.length
      ? Number((submitted.reduce((sum, a) => sum + (a.percentage || 0), 0) / submitted.length).toFixed(1))
      : 0;
    const bestScore = submitted.reduce((top, a) => Math.max(top, a.percentage || 0), 0);

    const recent = submitted.slice(0, 5);
    const exams = await db
      .collection("exams")
      .find({ _id: { $in: [...recent, ...(running ? [running] : [])].map((a) => a.examId) } })
      .toArray();
    const examById = new Map(exams.map((exam) => [exam._id.toString(), exam]));

    return successResponse({
      student: { id: student._id.toString(), name: student.name, email: student.email },
      statistics: {
        openExams,
        completedExams: submitted.length,
        averageScore,
        bestScore: Number(bestScore.toFixed(1)),
      },
      inProgress: running ? serializeAttemptSummary(running, examById.get(running.examId.toString())) : null,
      recentResults: recent.map((a) => serializeAttemptSummary(a, examById.get(a.examId.toString()))),
    });
  } catch (error) {
    console.error("GET Student Dashboard Exception", error);
    return errorResponse("Unable to load your dashboard.", 500);
  }
}
export const GET = withAuth("student", handleGET);

