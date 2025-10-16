import { NextRequest, NextResponse } from "next/server";
import { connectDB, Project } from "@repo/database";

// GET: Fetch AI chat history for a project
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await context.params;

    const project = await Project.findById(id).select("aiChats");
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ aiChats: project.aiChats || [] });
  } catch (error) {
    console.error("Error fetching AI chat history:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI chat history" },
      { status: 500 },
    );
  }
}

// POST: Process AI chat message with restrictions and rate limiting
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await context.params;
    const { userMessage, userEmail } = await req.json();

    if (!userMessage || !userEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check rate limit (10 requests per minute per user)
    if (!checkRateLimit(userEmail)) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. Please wait a minute before sending another message.",
        },
        { status: 429 },
      );
    }

    // Validate if message is coding-related
    const codingKeywords = [
      "code",
      "function",
      "class",
      "variable",
      "error",
      "bug",
      "debug",
      "syntax",
      "algorithm",
      "programming",
      "javascript",
      "typescript",
      "react",
      "node",
      "api",
      "database",
      "query",
      "component",
      "state",
      "props",
      "import",
      "export",
      "async",
      "await",
      "promise",
      "array",
      "object",
      "string",
      "number",
      "boolean",
      "loop",
      "condition",
      "git",
      "version",
      "merge",
      "commit",
      "branch",
      "file",
      "folder",
      "path",
      "module",
      "package",
      "html",
      "css",
      "python",
      "java",
      "c++",
      "php",
      "sql",
      "json",
      "xml",
    ];

    const isCodingRelated = codingKeywords.some((keyword) =>
      userMessage.toLowerCase().includes(keyword),
    );

    if (!isCodingRelated && userMessage.length > 10) {
      return NextResponse.json(
        {
          error:
            "I can only help with coding and programming questions. Please ask something related to code, development, or technical issues.",
        },
        { status: 400 },
      );
    }

    // Get project context
    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectContext = project.structure
      ? `Project structure: ${JSON.stringify(project.structure, null, 2)}`
      : "No project structure available";

    // Call Gemini AI with restricted system prompt
    const systemPrompt = `You are a coding assistant that ONLY answers questions related to programming, code, software development, and technical topics.

CRITICAL RULES:
- ONLY answer questions about code, programming, debugging, algorithms, software architecture, development tools, and technical concepts
- If the question is NOT about coding/programming, politely decline and redirect to coding topics
- Stay focused on the current project context provided
- Provide practical, actionable coding advice
- Use the project structure and code context when relevant

Current Project Context:
${projectContext}

If this question is not about coding, respond with: "I'm sorry, but I can only assist with coding and programming questions. Please ask me something related to code, development, or technical issues."`;

    const aiResponse = await callGeminiAPI(systemPrompt, userMessage);

    // Save both user message and AI response to database
    const userChatMessage = {
      role: "user" as const,
      content: userMessage,
      userEmail,
      timestamp: new Date(),
    };

    const aiChatMessage = {
      role: "assistant" as const,
      content: aiResponse,
      userEmail: "assistant",
      timestamp: new Date(),
    };

    await Project.findByIdAndUpdate(id, {
      $push: { aiChats: { $each: [userChatMessage, aiChatMessage] } },
    });

    return NextResponse.json({
      userMessage: userChatMessage,
      aiMessage: aiChatMessage,
    });
  } catch (error) {
    console.error("Error processing AI chat:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 },
    );
  }
}

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration
const RATE_LIMIT = {
  maxRequests: 10, // 10 requests per window
  windowMs: 60 * 1000, // 1 minute window
};

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitStore.get(identifier);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT.maxRequests) {
    return false; // Rate limit exceeded
  }

  userLimit.count++;
  return true;
}

// Helper function to call Gemini API
async function callGeminiAPI(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\nUser Question: ${userMessage}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API error:", errorData);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Invalid response format from Gemini API");
    }
  } catch (error) {
    console.error("Gemini API call failed:", error);
    return "Sorry, I'm having trouble connecting to the AI service right now. Please try again.";
  }
}
