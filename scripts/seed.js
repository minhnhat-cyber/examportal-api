import bcrypt from "bcrypt";
import { MongoClient } from "mongodb";

const client=new MongoClient(process.env.MONGODB_URI);
const dbName=process.env.DB_NAME||"examportal";
const now=new Date();
const date=days=>new Date(now.getTime()+days*86400000);
const save=async(collection,key,data)=>{await collection.updateOne(key,{$set:data,$setOnInsert:{createdAt:now}},{upsert:true});return collection.findOne(key)};

try{
 await client.connect();
 const db=client.db(dbName),users=db.collection("users"),questions=db.collection("questions"),exams=db.collection("exams"),attempts=db.collection("attempts");
 await Promise.all([users.createIndex({email:1},{unique:true}),questions.createIndex({code:1},{unique:true}),exams.createIndex({code:1},{unique:true}),attempts.createIndex({examId:1,studentId:1,attemptNumber:1},{unique:true})]);
 const password=await bcrypt.hash("Password123!",12);
 const teacher=await save(users,{email:"teacher@examportal.local"},{name:"Dr. Taylor",email:"teacher@examportal.local",password,role:"teacher",status:"active",updatedAt:now});
 const studentInputs=[["John Doe","john@examportal.local"],["Alice Johnson","alice@examportal.local"],["Michael Chen","michael@examportal.local"]];
 const students=[];for(const [name,email] of studentInputs)students.push(await save(users,{email},{name,email,password,role:"student",status:"active",updatedAt:now}));
 const inputs=[
  ["Q-DS-001","Which data structure uses the Last In First Out principle?",["Queue","Stack","Array","Linked List"],1,"Data Structures","easy"],
  ["Q-DS-002","What is the average time complexity of binary search?",["O(1)","O(log n)","O(n)","O(n²)"],1,"Data Structures","medium"],
  ["Q-DB-001","Which SQL command retrieves data from a table?",["SELECT","UPDATE","DELETE","DROP"],0,"Database Systems","easy"],
  ["Q-WEB-001","Which HTTP method normally creates a resource?",["GET","POST","PUT","DELETE"],1,"Web Development","easy"],
  ["Q-WEB-002","Which status code means Not Found?",["200","201","404","500"],2,"Web Development","easy"],
 ];
 const saved=[];for(const [code,text,options,correctOption,topic,difficulty] of inputs)saved.push(await save(questions,{code},{code,text,options,correctOption,topic,difficulty,points:1,createdBy:teacher._id,status:"active",updatedAt:now}));
 const active=await save(exams,{code:"EX-DS-001"},{code:"EX-DS-001",title:"Data Structures Midterm",description:"Core data structures assessment",subject:"Computer Science",durationMinutes:60,opensAt:date(-1),closesAt:date(7),questionIds:saved.slice(0,2).map(x=>x._id),createdBy:teacher._id,status:"active",studentCount:3,attemptCount:1,updatedAt:now});
 await save(exams,{code:"EX-WEB-001"},{code:"EX-WEB-001",title:"Web Development Basics",description:"HTTP and web foundations",subject:"Web Development",durationMinutes:40,opensAt:date(10),closesAt:date(12),questionIds:saved.slice(3).map(x=>x._id),createdBy:teacher._id,status:"scheduled",studentCount:3,attemptCount:0,updatedAt:now});
 await save(attempts,{examId:active._id,studentId:students[0]._id,attemptNumber:1},{examId:active._id,studentId:students[0]._id,attemptNumber:1,answers:[{questionId:saved[0]._id,selectedOption:1},{questionId:saved[1]._id,selectedOption:1}],score:2,totalPoints:2,percentage:100,status:"submitted",startedAt:date(-0.2),submittedAt:date(-0.19),updatedAt:now});
 console.log("Seed complete: 4 users, 5 questions, 2 exams, 1 attempt.");
 console.log("Demo password: Password123!");
}finally{await client.close()}
