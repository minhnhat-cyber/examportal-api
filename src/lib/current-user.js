import { ObjectId } from "mongodb";

export async function getCurrentStudent(request, db) {
    const filter = { role: "student", status: "active" };
    const users = db.collection("users");
    const headerId = request.headers.get("x-student-id")?.trim();
    if (headerId) {
        if (!ObjectId.isValid(headerId)) {
            return null;
        }
        return users.findOne({ ...filter, _id: new ObjectId(headerId) });
    }
    return users.findOne(filter, { sort: { name: 1 }});
    }
