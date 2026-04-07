const SYSTEM_PROMPT = `You are a precise code complexity analyzer. Given source code, analyze it and return ONLY a valid JSON object with no markdown fences, no preamble. The JSON must have this exact structure:

{
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "confidence": "high" | "medium" | "low",
  "summary": "One sentence summary of the analysis",
  "loops": [{"description": "...", "complexity": "O(...)"}],
  "recursion": [{"description": "...", "complexity": "O(...)"}],
  "dataStructures": [{"name": "...", "impact": "O(...)"}],
  "explanation": ["Step 1...", "Step 2...", "Step 3..."],
  "observations": ["Key observation 1", "Key observation 2"],
  "optimizationSuggestions": ["Suggestion 1"]
}

Rules:
- For loops iterating n times nested k deep, report O(n^k).
- For recursion like fibonacci, report O(2^n). For divide-and-conquer like merge sort, use Master theorem.
- Account for STL: map/set operations O(log n), unordered_map/unordered_set O(1) avg.
- Always fill every field. Use empty arrays if not applicable.
- Keep explanations clear, educational, and concise.
- confidence should be "high" if the code is straightforward, "medium" if heuristic, "low" if ambiguous.`;

export async function POST(request) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return Response.json({ error: "No code provided" }, { status: 400 });
    }

    if (code.length > 20000) {
      return Response.json(
        { error: "Code too long (max 20,000 chars)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY not configured on the server" },
        { status: 500 }
      );
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyze this code:\n\n${code}` },
        ],
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("OpenAI API error:", resp.status, errBody);
      return Response.json(
        { error: "Upstream API error" },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleaned);

    return Response.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return Response.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
