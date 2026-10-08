import { withAuth } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { successResponse, errorResponse } from "@/lib/utils";
import { getCurrentStudent } from "@/lib/current-user";
export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
async function handleGET(request) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "examportal");

    const student = await getCurrentStudent(request, db);
    if (!student) return errorResponse("No active student account was found.", 401);

    const now = new Date();
    const exams = await db
    .collection("exams")
    .find({ status: { $in: ["active", "scheduled"] } })
    .sort({ opensAt: 1 })
    .toArray();

    const items = exams.map((exam) => {
    const opensAt = new Date(exam.opensAt);
    const closesAt = new Date(exam.closesAt);

    // 1. is it startable right now?
    //    needs: status is "active", AND now is between opensAt and closesAt
    const canStart = now >= opensAt && now <= closesAt && exam.status === "active";

    // 2. if not, why not? "upcoming" or "closed"
    const availability = canStart ? "open" : now < opensAt ? "upcoming" : "closed";

    return {
        id: exam._id.toString(),
        code: exam.code,
        title: exam.title,
        subject: exam.subject,
        durationMinutes: exam.durationMinutes,
        questionCount: (exam.questionIds || []).length,
        opensAt: exam.opensAt,
        closesAt: exam.closesAt,
        canStart,
        availability,
    };
    });

return successResponse({ items });

  } catch (error) {
    console.error("GET Student Exams Exception", error);
    return errorResponse("Unable to load available exams.", 500);
  }
}
export const GET = withAuth("student", handleGET);

