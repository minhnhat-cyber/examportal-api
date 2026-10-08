import corsHeaders from "@/lib/cors";
import { database, hashToken, tokenFrom, originAllowed, sessionCookie } from "@/lib/auth";
export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
export async function POST(request) {
  if (!originAllowed(request)) return Response.json({ message: "Invalid request origin." }, { status: 403, headers: corsHeaders });
  try {
    const token = tokenFrom(request);
    if (token) await (await database()).collection("sessions").deleteOne({ _id: hashToken(token) });
    return Response.json({ message: "Signed out." }, { headers: { ...corsHeaders, "Set-Cookie": sessionCookie("", 0) } });
  } catch { return Response.json({ message: "Unable to sign out. Please try again." }, { status: 503, headers: corsHeaders }); }
}
