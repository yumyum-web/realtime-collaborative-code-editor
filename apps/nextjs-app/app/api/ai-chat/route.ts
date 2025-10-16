import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  if (!prompt) {
    return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found in environment variables");
    return NextResponse.json(
      {
        error: "Gemini models are inaccessible.",
      },
      { status: 500 },
    );
  }

  const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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
      const response = data.candidates[0].content.parts[0].text;
      return NextResponse.json({ response });
    }

    throw new Error(data.error?.message || "Unknown error from Gemini API");
  } catch (e) {
    console.log(` Model ${modelName} error:`, e);

    return NextResponse.json(
      {
        error: "Gemini models failed or are inaccessible.",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
