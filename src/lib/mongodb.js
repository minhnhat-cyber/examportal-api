import { MongoClient } from "mongodb";
const options={}; let globalClientPromise;
export function getClientPromise(){const uri=process.env.MONGODB_URI;if(!uri)throw new Error("Please add MONGODB_URI to .env.local");if(process.env.NODE_ENV==="development"){if(!globalClientPromise)globalClientPromise=new MongoClient(uri,options).connect();return globalClientPromise}return new MongoClient(uri,options).connect()}
