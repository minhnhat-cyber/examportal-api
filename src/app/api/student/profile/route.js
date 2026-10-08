import { withAuth } from "@/lib/auth";
import bcrypt from "bcrypt";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse, successResponse } from "@/lib/utils";
import { getCurrentStudent } from "@/lib/current-user";

export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

const serialize = (user, stats = {}) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  ...stats,
});

/** The signed-in student's own profile, plus a couple of summary numbers. */
async function handleGET(request) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "examportal");

    const student = await getCurrentStudent(request, db);
    if (!student) return errorResponse("No active student account was found.", 401);

    const attempts = db.collection("attempts");
    const [totalAttempts, submitted] = await Promise.all([
      attempts.countDocuments({ studentId: student._id }),
      attempts.find({ studentId: student._id, status: "submitted" }, { projection: { percentage: 1 } }).toArray(),
    ]);

    const averageScore = submitted.length
      ? Number((submitted.reduce((sum, a) => sum + (a.percentage || 0), 0) / submitted.length).toFixed(1))
      : 0;

    return successResponse(
      serialize(student, { totalAttempts, completedAttempts: submitted.length, averageScore }),
    );
  } catch (error) {
    console.error("GET Student Profile Exception", error);
    return errorResponse("Unable to load your profile.", 500);
  }
}

/**
 * Updates the student's own name, and optionally their password.
 *
 * Role and status are deliberately not editable here — a student must not be
 * able to promote themselves to teacher or reactivate a disabled account.
 * Changing the password requires the current one; pointless today with no
 * login, but it means the check is already in place when auth lands.
 */
async function handlePUT(request) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.DB_NAME || "examportal");

    const student = await getCurrentStudent(request, db);
    if (!student) return errorResponse("No active student account was found.", 401);

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!name) return errorResponse("Name is required.", 400);

    const update = { name, updatedAt: new Date() };

    const newPassword = String(body.newPassword || "");
    if (newPassword) {
      const currentPassword = String(body.currentPassword || "");
      if (!currentPassword) return errorResponse("Your current password is required to set a new one.", 400);
      if (!(await bcrypt.compare(currentPassword, student.password))) {
        return errorResponse("Your current password is incorrect.", 400);
      }
      if (newPassword.length < 8) return errorResponse("The new password must contain at least 8 characters.", 400);
      update.password = await bcrypt.hash(newPassword, 12);
    }

    const updated = await db.collection("users").findOneAndUpdate(
      { _id: student._id },
      { $set: update },
      { returnDocument: "after", projection: { password: 0 } },
    );

    return updated ? successResponse(serialize(updated)) : errorResponse("Student not found.", 404);
  } catch (error) {
    console.error("PUT Student Profile Exception", error);
    return errorResponse("Unable to update your profile.", 500);
  }
}
export const GET = withAuth("student", handleGET);
export const PUT = withAuth("student", handlePUT);

