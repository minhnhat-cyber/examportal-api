import { withAuth } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { getCurrentStudent } from "@/lib/current-user";
import { expireIfElapsed } from "@/lib/grading";
import { serializeAttemptSummary } from "@/lib/student-serializers";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

/** The current student's own attempt history, newest first. */
async function handleGET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const search = searchParams.get("search")?.trim().toLowerCase();

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "examportal");

    const student = await getCurrentStudent(request, db);
    if (!student) return errorResponse("No active student account was found.", 401);

    const raw = await db
      .collection("attempts")
      .find({ studentId: student._id })
      .sort({ startedAt: -1 })
      .limit(100)
      .toArray();

    // Settle anything that timed out while the student was away.
    const now = new Date();
    const attempts = await Promise.all(raw.map((attempt) => expireIfElapsed(db, attempt, now)));

    const exams = await db
      .collection("exams")
      .find({ _id: { $in: attempts.map((attempt) => attempt.examId) } })
      .toArray();
    const examById = new Map(exams.map((exam) => [exam._id.toString(), exam]));

    let items = attempts.map((attempt) => serializeAttemptSummary(attempt, examById.get(attempt.examId.toString())));
    if (status) items = items.filter((item) => item.status === status);
    if (search) {
      items = items.filter((item) =>
        `${item.examTitle} ${item.examCode} ${item.examSubject}`.toLowerCase().includes(search),
      );
    }

    return successResponse({ items });
  } catch (error) {
    console.error("GET Student Attempts Exception", error);
    return errorResponse("Unable to load your attempt history.", 500);
  }
}
export const GET = withAuth("student", handleGET);

