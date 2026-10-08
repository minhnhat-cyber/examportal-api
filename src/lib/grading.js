import { answerMap } from "./student-serializers";

/**
 * Grades an attempt on the server and writes the result.
 *
 * Grading never happens in the browser: the client only ever sends selected
 * option indexes, and the answer key is read straight from the database here.
 * Used by the submit route and by the expiry path, so a student who closes
 * the tab still gets the answers they had saved marked.
 */
export async function gradeAttempt(db, attempt, { autoSubmitted = false, submittedAt = new Date() } = {}) {
  const questionIds = attempt.questionIds?.length
    ? attempt.questionIds
    : (attempt.answers || []).map((answer) => answer.questionId);

  const questions = await db.collection("questions").find({ _id: { $in: questionIds } }).toArray();

  const selected = answerMap(attempt);
  let score = 0;
  let totalPoints = 0;
  let correctCount = 0;

  for (const question of questions) {
    totalPoints += question.points;
    if (selected[question._id.toString()] === question.correctOption) {
      score += question.points;
      correctCount += 1;
    }
  }

  const percentage = totalPoints > 0 ? Number(((score / totalPoints) * 100).toFixed(1)) : 0;

  const update = {
    status: "submitted",
    score,
    totalPoints,
    percentage,
    correctCount,
    questionCount: questions.length,
    autoSubmitted,
    submittedAt,
    updatedAt: new Date(),
  };

  await db.collection("attempts").updateOne({ _id: attempt._id }, { $set: update });
  return { ...attempt, ...update };
}

/**
 * Submits an attempt whose time has run out. Lazy expiry: called whenever an
 * attempt is read, so a student who closes the tab and never returns is
 * settled the next time anyone looks. No background job needed.
 */
export async function expireIfElapsed(db, attempt, now = new Date()) {
  if (attempt.status !== "in_progress") return attempt;
  if (!attempt.expiresAt || new Date(attempt.expiresAt) > now) return attempt;
  return gradeAttempt(db, attempt, { autoSubmitted: true, submittedAt: new Date(attempt.expiresAt) });
}