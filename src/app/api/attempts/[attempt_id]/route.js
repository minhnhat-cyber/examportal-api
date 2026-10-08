import { withAuth } from "@/lib/auth";
import { ObjectId } from "mongodb";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { getCurrentStudent } from "@/lib/current-user";
import { expireIfElapsed } from "@/lib/grading";
import {
  answerMap,
  remainingSeconds,
  serializeAttemptSummary,
  serializeQuestionForAttempt,
  serializeQuestionForReview,
} from "@/lib/student-serializers";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

/**
 * Loads an attempt and checks it belongs to the student making the request.
 * Returns 404 rather than 403 when it does not — a "forbidden" reply would
 * tell an attacker which attempt ids exist.
 */
async function loadOwnedAttempt(request, db, attemptId) {
  if (!ObjectId.isValid(attemptId)) return { error: "Invalid attempt ID.", status: 400 };

  const student = await getCurrentStudent(request, db);
  if (!student) return { error: "No active student account was found.", status: 401 };

  const attempt = await db.collection("attempts").findOne({ _id: new ObjectId(attemptId) });
  if (!attempt) return { error: "Attempt not found.", status: 404 };
  if (!attempt.studentId.equals(student._id)) return { error: "Attempt not found.", status: 404 };

  return { attempt, student };
}

/**
 * Returns the attempt in whichever shape its status calls for: the paper
 * without the answer key while it is running, or the marked paper once it has
 * been submitted. An attempt whose time ran out while the tab was closed is
 * graded here before it is returned.
 */
async function handleGET(request, { params }) {
  try {
    const { attempt_id } = await params;
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "examportal");

    const loaded = await loadOwnedAttempt(request, db, attempt_id);
    if (loaded.error) return errorResponse(loaded.error, loaded.status);

    const now = new Date();
    const attempt = await expireIfElapsed(db, loaded.attempt, now);
    const exam = await db.collection("exams").findOne({ _id: attempt.examId });

    const questionIds = attempt.questionIds || [];
    const questions = await db.collection("questions").find({ _id: { $in: questionIds } }).toArray();

    // Keep the stored order, so question 3 is always question 3.
    const ordered = questionIds
      .map((id) => questions.find((question) => question._id.equals(id)))
      .filter(Boolean);

    const selected = answerMap(attempt);
    const submitted = attempt.status === "submitted";

    return successResponse({
      attempt: serializeAttemptSummary(attempt, exam),
      exam: exam
        ? { id: exam._id.toString(), code: exam.code, title: exam.title, subject: exam.subject, durationMinutes: exam.durationMinutes }
        : null,
      remainingSeconds: submitted ? 0 : remainingSeconds(attempt, now),
      questions: ordered.map((question) =>
        submitted
          ? serializeQuestionForReview(question, selected[question._id.toString()] ?? null)
          : serializeQuestionForAttempt(question),
      ),
      answers: submitted ? {} : selected,
    });
  } catch (error) {
    console.error("GET Attempt Exception", error);
    return errorResponse("Unable to load the attempt.", 500);
  }
}

/**
 * Saves answers while the exam is being taken. The client sends the whole
 * answer set and it replaces what is stored. Rejected once the deadline has
 * passed — that attempt gets auto-graded instead.
 */
async function handlePATCH(request, { params }) {
  try {
    const { attempt_id } = await params;
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "examportal");

    const loaded = await loadOwnedAttempt(request, db, attempt_id);
    if (loaded.error) return errorResponse(loaded.error, loaded.status);

    const now = new Date();
    const attempt = await expireIfElapsed(db, loaded.attempt, now);
    if (attempt.status !== "in_progress") return errorResponse("This attempt has already been submitted.", 409);

    const body = await request.json().catch(() => ({}));
    const incoming = Array.isArray(body.answers) ? body.answers : [];
    const allowed = new Set((attempt.questionIds || []).map((id) => id.toString()));

    const answers = [];
    for (const entry of incoming) {
      const questionId = String(entry?.questionId || "");
      if (!allowed.has(questionId)) return errorResponse("An answer refers to a question outside this exam.", 400);
      const option = entry.selectedOption;
      if (option === null || option === undefined) continue; // cleared answer
      if (!Number.isInteger(option) || option < 0 || option > 3) return errorResponse("Selected option must be from 0 to 3.", 400);
      answers.push({ questionId: new ObjectId(questionId), selectedOption: option });
    }

    await db.collection("attempts").updateOne(
      { _id: attempt._id },
      { $set: { answers, updatedAt: now } },
    );

    return successResponse({ saved: true, answeredCount: answers.length, remainingSeconds: remainingSeconds(attempt, now) });
  } catch (error) {
    console.error("PATCH Attempt Exception", error);
    return errorResponse("Unable to save your answers.", 500);
  }
}
export const GET = withAuth("student", handleGET);
export const PATCH = withAuth("student", handlePATCH);

