import { ObjectId } from "mongodb";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { getCurrentStudent } from "@/lib/current-user";

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


/**
 * Starts an attempt for the current student.
 *
 * The client sends only an examId. The exam window, the duration and the
 * question list are all read from the database, and expiresAt is stamped here
 * so the deadline survives a refresh, a closed tab or a changed system clock.
 * An unfinished attempt is resumed rather than duplicated.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const examId = String(body.examId || "").trim();
    if (!ObjectId.isValid(examId)) return errorResponse("Invalid exam ID.", 400);

    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "examportal");

    const student = await getCurrentStudent(request, db);
    if (!student) return errorResponse("No active student account was found.", 401);

    const exam = await db.collection("exams").findOne({ _id: new ObjectId(examId) });
    if (!exam) return errorResponse("Exam not found.", 404);

    const now = new Date();
    if (exam.status !== "active") return errorResponse("This exam is not open for attempts.", 409);
    if (exam.opensAt && new Date(exam.opensAt) > now) return errorResponse("This exam has not opened yet.", 409);
    if (exam.closesAt && new Date(exam.closesAt) < now) return errorResponse("This exam has already closed.", 409);
    if (!exam.questionIds?.length) return errorResponse("This exam has no questions yet.", 409);

    const attempts = db.collection("attempts");

    // Resume rather than duplicate.
    const existing = await attempts.findOne({ examId: exam._id, studentId: student._id, status: "in_progress" });
    if (existing) {
      if (new Date(existing.expiresAt) > now) {
        return successResponse({ id: existing._id.toString(), resumed: true, expiresAt: existing.expiresAt });
      }
      return errorResponse("Your previous attempt has expired. Open it from My Results to see the score.", 409);
    }

    // The exam window can end before the full duration has elapsed.
    const examClosesAt = exam.closesAt ? new Date(exam.closesAt) : null;
    const durationEnd = new Date(now.getTime() + exam.durationMinutes * 60000);
    const expiresAt = examClosesAt && examClosesAt < durationEnd ? examClosesAt : durationEnd;

    const attemptNumber = (await attempts.countDocuments({ examId: exam._id, studentId: student._id })) + 1;

    const document = {
      examId: exam._id,
      studentId: student._id,
      attemptNumber,
      // Snapshot: a teacher editing the exam mid-attempt cannot change the
      // paper this student is graded on.
      questionIds: exam.questionIds,
      answers: [],
      status: "in_progress",
      score: null,
      totalPoints: null,
      percentage: null,
      startedAt: now,
      expiresAt,
      submittedAt: null,
      autoSubmitted: false,
      updatedAt: now,
    };

    const result = await attempts.insertOne(document);
    await db.collection("exams").updateOne({ _id: exam._id }, { $inc: { attemptCount: 1 } });

    return successResponse({ id: result.insertedId.toString(), resumed: false, expiresAt }, 201);
  } catch (error) {
    if (error?.code === 11000) return errorResponse("An attempt is already in progress.", 409);
    console.error("POST Attempt Exception", error);
    return errorResponse("Unable to start the attempt.", 500);
  }
}