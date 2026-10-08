import { withAuth } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import { errorResponse,successResponse } from "@/lib/utils";
export function OPTIONS(){return new Response(null,{status:200,headers:corsHeaders})}
async function handleGET(){try{const client=await getClientPromise();const db=client.db(process.env.DB_NAME||"examportal");const now=new Date();const [activeExams,totalQuestions,studentAttempts,average,recentExams]=await Promise.all([db.collection("exams").countDocuments({$or:[{status:"active"},{status:"published",opensAt:{$lte:now},closesAt:{$gte:now}}]}),db.collection("questions").countDocuments(),db.collection("attempts").countDocuments(),db.collection("attempts").aggregate([{$match:{status:"submitted",percentage:{$type:"number"}}},{$group:{_id:null,value:{$avg:"$percentage"}}}]).next(),db.collection("exams").find({}).sort({createdAt:-1}).limit(6).toArray()]);return successResponse({statistics:{activeExams,totalQuestions,studentAttempts,averageScore:Number((average?.value||0).toFixed(1))},recentExams:recentExams.map(x=>({id:x._id.toString(),title:x.title||"Untitled exam",subject:x.subject||"General",durationMinutes:x.durationMinutes||0,opensAt:x.opensAt||null,closesAt:x.closesAt||null,attemptCount:x.attemptCount||0,studentCount:x.studentCount||0,status:x.status||"draft"}))})}catch(error){console.log("GET Teacher Dashboard Exception",error);return errorResponse("GET Teacher Dashboard Internal Error",500)}}

export const GET = withAuth("teacher", handleGET);

