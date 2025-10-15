import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "No prompt provided" },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY not found in environment variables");
      return NextResponse.json(
        {
          error:
            "API key not configured. Please add GEMINI_API_KEY to your .env file",
        },
        { status: 500 },
      );
    }

    // Try different model names in order of preference
    const modelsToTry = [
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-1.5-pro-latest",
      "gemini-pro",
    ];

    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        console.log(`Trying Gemini API with model: ${modelName}`);
        const geminiRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        });

        const data = await geminiRes.json();

        if (geminiRes.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.log(` Success with model: ${modelName}`);
          const response = data.candidates[0].content.parts[0].text;
          return NextResponse.json({ response });
        }

        lastError = data;
        console.log(` Model ${modelName} failed:`, data.error?.message);
      } catch (e) {
        console.log(` Model ${modelName} error:`, e);
        lastError = e;
      }
    }

    // All models failed
    console.error("All Gemini models failed. Last error:", lastError);
    return NextResponse.json(
      {
        error:
          "All available Gemini models failed. Your API key might need to be regenerated.",
        details: lastError,
      },
      { status: 500 },
    );
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      {
        error: "Failed to contact Gemini API",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
