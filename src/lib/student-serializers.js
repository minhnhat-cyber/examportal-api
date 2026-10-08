/**
 * Serializers for what a student is allowed to see.
 *
 * The teacher's serializeQuestion in question-validation.js includes
 * `correctOption`. Student routes must never use it: the proposal commits to
 * correct answers not reaching the browser before submission.
 */

/** A question as it appears while the exam is being taken — no answer key. */
export function serializeQuestionForAttempt(question) {
  return {
    id: question._id.toString(),
    text: question.text,
    topic: question.topic,
    options: question.options,
    difficulty: question.difficulty,
    points: question.points,
  };
}

/**
 * A question in the post-submission review. The answer key IS included here,
 * on purpose: the attempt is already graded, so it can no longer be used to
 * cheat. Only ever call this once status === "submitted".
 */
export function serializeQuestionForReview(question, selectedOption) {
  const correct = selectedOption === question.correctOption;
  return {
    ...serializeQuestionForAttempt(question),
    correctOption: question.correctOption,
    selectedOption: selectedOption ?? null,
    isCorrect: correct,
    earnedPoints: correct ? question.points : 0,
  };
}

/** The stored answers as a plain { questionId: selectedOption } object. */
export function answerMap(attempt) {
  const map = {};
  for (const answer of attempt.answers || []) {
    map[answer.questionId.toString()] = answer.selectedOption;
  }
  return map;
}

/** Whole seconds left on an attempt, floored at zero. */
export function remainingSeconds(attempt, now = new Date()) {
  if (!attempt.expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - now.getTime()) / 1000));
}

/** One row of the attempt history / result header. */
export function serializeAttemptSummary(attempt, exam) {
  return {
    id: attempt._id.toString(),
    examId: attempt.examId.toString(),
    examTitle: exam?.title || "Deleted exam",
    examCode: exam?.code || "-",
    examSubject: exam?.subject || "-",
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    score: attempt.score ?? null,
    totalPoints: attempt.totalPoints ?? null,
    percentage: attempt.percentage ?? null,
    correctCount: attempt.correctCount ?? null,
    questionCount: attempt.questionCount ?? null,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt || null,
    submittedAt: attempt.submittedAt || null,
    autoSubmitted: attempt.autoSubmitted || false,
  };
}