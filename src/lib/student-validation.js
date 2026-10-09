export function serializeStudent(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, status: user.status, createdAt: user.createdAt, updatedAt: user.updatedAt || null };
}

export function validateStudent(input, creating = false) {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const status = String(input.status || "active").toLowerCase();
  const password = String(input.password || "");
  if (!name || !/^[^\s@]+@[^\s@]+$/.test(email)) return { error: "A valid name and email are required." };
  if (!new Set(["active", "inactive"]).has(status)) return { error: "Invalid student status." };
  if (creating && password.length < 8) return { error: "Password must contain at least 8 characters." };
  return { value: { name, email, status, password } };
}
