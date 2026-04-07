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

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function normalizeModelName(model) {
  if (!model) return "";
  return model.startsWith("models/") ? model : `models/${model}`;
}

async function callGeminiGenerateContent({ apiKey, model, promptText }) {
  const modelName = normalizeModelName(model);
  return fetch(
    `${GEMINI_API_BASE}/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          maxOutputTokens: 1500,
        },
      }),
    }
  );
}

function pickFallbackModel(models) {
  const supported = (models || []).filter((m) =>
    (m.supportedGenerationMethods || []).includes("generateContent")
  );

  if (supported.length === 0) return null;

  const preferred = supported.find((m) =>
    m.name?.includes("gemini-2.0-flash")
  );
  if (preferred) return preferred.name;

  const anyFlash = supported.find((m) => m.name?.includes("flash"));
  if (anyFlash) return anyFlash.name;

  return supported[0].name;
}

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

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY not configured on the server" },
        { status: 500 }
      );
    }

    const promptText = `${SYSTEM_PROMPT}\n\nAnalyze this code:\n\n${code}`;

    let resp = await callGeminiGenerateContent({
      apiKey,
      model,
      promptText,
    });

    if (!resp.ok) {
      const firstErrBody = await resp.text();
      let canFallback = false;

      try {
        const parsed = JSON.parse(firstErrBody);
        const msg = parsed?.error?.message || "";
        canFallback =
          msg.includes("not found") || msg.includes("not supported for generateContent");
      } catch {}

      if (canFallback) {
        const modelsResp = await fetch(`${GEMINI_API_BASE}/models?key=${apiKey}`);
        if (modelsResp.ok) {
          const modelsData = await modelsResp.json();
          const fallbackModel = pickFallbackModel(modelsData.models || []);
          if (fallbackModel && normalizeModelName(model) !== fallbackModel) {
            resp = await callGeminiGenerateContent({
              apiKey,
              model: fallbackModel,
              promptText,
            });
          } else {
            console.error("Gemini API error:", 502, firstErrBody);
            return Response.json(
              { error: "No compatible Gemini generateContent model found for this key." },
              { status: 502 }
            );
          }
        } else {
          console.error("Gemini API error:", 502, firstErrBody);
          return Response.json(
            { error: "Configured Gemini model is unavailable, and model discovery failed." },
            { status: 502 }
          );
        }
      } else {
        console.error("Gemini API error:", resp.status, firstErrBody);
        let details = "Upstream API error";
        try {
          const parsed = JSON.parse(firstErrBody);
          details = parsed?.error?.message || details;
        } catch {}
        return Response.json({ error: details }, { status: 502 });
      }
    }

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("Gemini API error:", resp.status, errBody);
      let details = "Upstream API error";
      try {
        const parsed = JSON.parse(errBody);
        details = parsed?.error?.message || details;
      } catch {}
      return Response.json({ error: details }, { status: 502 });
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
