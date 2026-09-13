const difficulties = new Set(["easy", "medium", "hard"]);

export function validateQuestion(input) {
  const code = String(input.code || "").trim().toUpperCase();
  const text = String(input.text || "").trim();
  const topic = String(input.topic || "").trim();
  const options = Array.isArray(input.options) ? input.options.map((option) => String(option).trim()) : [];
  const difficulty = String(input.difficulty || "").toLowerCase();
  const correctOption = Number(input.correctOption);
  const points = Number(input.points);

  if (!code || !text || !topic) return { error: "Code, question text and topic are required." };
  if (options.length !== 4 || options.some((option) => !option)) return { error: "Exactly four non-empty options are required." };
  if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption > 3) return { error: "Correct option must be from 0 to 3." };
  if (!difficulties.has(difficulty)) return { error: "Difficulty must be easy, medium or hard." };
  if (!Number.isFinite(points) || points <= 0) return { error: "Points must be greater than zero." };

  return { value: { code, text, topic, options, correctOption, difficulty, points } };
}

export function serializeQuestion(question) {
  return {
    id: question._id.toString(),
    code: question.code,
    text: question.text,
    topic: question.topic,
    options: question.options,
    correctOption: question.correctOption,
    difficulty: question.difficulty,
    points: question.points,
    status: question.status || "active",
    createdAt: question.createdAt,
    updatedAt: question.updatedAt || null,
  };
}
