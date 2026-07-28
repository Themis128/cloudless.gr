import { NextRequest, NextResponse } from "next/server";
/**
 * POST /api/inbound-email
 * Webhook endpoint for Cloudflare Email Routing
 * Receives inbound emails and processes them (e.g., for support tickets, lead capture)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract email data from form data
    const sender = formData.get("sender") as string;
    const recipient = formData.get("recipient") as string;
    const subject = formData.get("subject") as string;
    const plain = formData.get("plain") as string; // Plain text body
    const html = formData.get("html") as string; // HTML body
    
    // Basic validation
    if (!sender || !recipient) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Log the inbound email (you could store in database, trigger workflows, etc.)
    console.log("Inbound email received:", {
      sender,
      recipient,
      subject,
      bodyLength: plain?.length || 0,
    });
    
    // Example: Store in database for support tickets
    // await prisma.supportTicket.create({
    //   data: {
    //     email: sender,
    //     subject: subject || "No Subject",
    //     description: plain || "",
    //     status: "NEW",
    //   }
    // });
    
    // Example: Forward to Slack or create EspoCRM case
    // You could integrate with your existing email processing logic here
    
    return NextResponse.json(
      { success: true, message: "Email processed" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Inbound email processing error:", error);
    return NextResponse.json(
      { error: "Failed to process email" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";