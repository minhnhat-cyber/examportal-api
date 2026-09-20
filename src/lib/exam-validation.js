import { ObjectId } from "mongodb";

const statuses = new Set(["draft", "scheduled", "active", "completed"]);

export function validateExam(input) {
  const code = String(input.code || "").trim().toUpperCase();
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const subject = String(input.subject || "").trim();
  const durationMinutes = Number(input.durationMinutes);
  const status = String(input.status || "draft").toLowerCase();
  const opensAt = new Date(input.opensAt);
  const closesAt = new Date(input.closesAt);
  const rawQuestionIds = Array.isArray(input.questionIds) ? input.questionIds : [];

  if (!code || !title || !subject) return { error: "Code, title and subject are required." };
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) return { error: "Duration must be a positive whole number." };
  if (!statuses.has(status)) return { error: "Invalid exam status." };
  if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime()) || opensAt >= closesAt) return { error: "Open and close times are invalid." };
  if (rawQuestionIds.some((id) => !ObjectId.isValid(id))) return { error: "One or more question IDs are invalid." };

  return { value: { code, title, description, subject, durationMinutes, status, opensAt, closesAt, questionIds: rawQuestionIds.map((id) => new ObjectId(id)) } };
}

export function serializeExam(exam) {
  return {
    id: exam._id.toString(), code: exam.code, title: exam.title,
    description: exam.description || "", subject: exam.subject,
    durationMinutes: exam.durationMinutes, opensAt: exam.opensAt,
    closesAt: exam.closesAt, status: exam.status,
    questionIds: (exam.questionIds || []).map((id) => id.toString()),
    questionCount: (exam.questionIds || []).length,
    attemptCount: exam.attemptCount || 0, studentCount: exam.studentCount || 0,
    createdAt: exam.createdAt, updatedAt: exam.updatedAt || null,
  };
}
