import { ObjectId } from "mongodb";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { getCurrentStudent } from "@/lib/current-user";
import { gradeAttempt } from "@/lib/grading";
import { serializeAttemptSummary } from "@/lib/student-serializers";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

/**
 * Submits and grades an attempt.
 *
 * Answers may be sent in the same call so the last selection before pressing
 * Submit is never lost to a race with the autosave. Marking is done entirely
 * from the database copy of the answer key — the browser never sees it and
 * never calculates a score.
 *
 * A late submission is still graded rather than rejected (the answers were
 * saved in time) but is flagged `autoSubmitted` so the teacher can see the
 * student ran out of time.
 */
export async function POST(request, { params }) {
  try {
    const { attempt_id } = await params;
    if (!ObjectId.isValid(attempt_id)) return errorResponse("Invalid attempt ID.", 400);

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "examportal");

    const student = await getCurrentStudent(request, db);
    if (!student) return errorResponse("No active student account was found.", 401);

    const attempts = db.collection("attempts");
    const attempt = await attempts.findOne({ _id: new ObjectId(attempt_id) });
    if (!attempt) return errorResponse("Attempt not found.", 404);
    if (!attempt.studentId.equals(student._id)) return errorResponse("Attempt not found.", 404);

    const exam = await db.collection("exams").findOne({ _id: attempt.examId });

    if (attempt.status === "submitted") {
      return successResponse({ attempt: serializeAttemptSummary(attempt, exam), alreadySubmitted: true });
    }

    const now = new Date();
    const expired = attempt.expiresAt ? new Date(attempt.expiresAt) < now : false;

    // Accept a final answer set only while the attempt is still live.
    const body = await request.json().catch(() => ({}));
    if (!expired && Array.isArray(body.answers)) {
      const allowed = new Set((attempt.questionIds || []).map((id) => id.toString()));
      const answers = [];
      for (const entry of body.answers) {
        const questionId = String(entry?.questionId || "");
        if (!allowed.has(questionId)) return errorResponse("An answer refers to a question outside this exam.", 400);
        const option = entry.selectedOption;
        if (option === null || option === undefined) continue;
        if (!Number.isInteger(option) || option < 0 || option > 3) return errorResponse("Selected option must be from 0 to 3.", 400);
        answers.push({ questionId: new ObjectId(questionId), selectedOption: option });
      }
      attempt.answers = answers;
      await attempts.updateOne({ _id: attempt._id }, { $set: { answers, updatedAt: now } });
    }

    const graded = await gradeAttempt(db, attempt, {
      autoSubmitted: expired,
      submittedAt: expired ? new Date(attempt.expiresAt) : now,
    });

    return successResponse({ attempt: serializeAttemptSummary(graded, exam), alreadySubmitted: false });
  } catch (error) {
    console.error("POST Submit Attempt Exception", error);
    return errorResponse("Unable to submit the attempt.", 500);
  }
}