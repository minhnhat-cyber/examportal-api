import { MongoClient } from "mongodb";
let clientPromise;
export function getClientPromise() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Please add MONGODB_URI to .env.local");
  if (!clientPromise) clientPromise = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 }).connect().catch(error => { clientPromise = undefined; throw error; });
  return clientPromise;
}
