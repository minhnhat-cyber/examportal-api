import { NextResponse } from "next/server";
import corsHeaders from "./cors";
export function successResponse(data,status=200){return NextResponse.json(data,{status,headers:corsHeaders})}
export function errorResponse(message,status=500){return NextResponse.json({message},{status,headers:corsHeaders})}
