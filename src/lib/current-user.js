import { currentUser } from "./auth.js";

export async function getCurrentStudent(request, db) {
    const user = await currentUser(request, db);
    return user?.role === "student" ? user : null;
    }
