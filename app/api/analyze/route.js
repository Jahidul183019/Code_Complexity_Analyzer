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

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "openrouter/auto";
const OPENROUTER_FREE_FALLBACK_MODELS = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "google/gemma-2-9b-it:free",
];

function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

async function callOpenRouter({ apiKey, model, promptText }) {
  return fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://code-complexity-analyzer.vercel.app",
      "X-Title": "Code Complexity Analyzer",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analyze this code:\n\n${promptText}` },
      ],
    }),
  });
}

function mapOpenRouterError(errText, fallback = "Upstream API error") {
  let details = fallback;

  try {
    const parsed = JSON.parse(errText);
    const msg = parsed?.error?.message || parsed?.message || "";
    const code = parsed?.error?.code || parsed?.code;

    if (code === 429 || /quota|rate limit|credits|insufficient/i.test(msg)) {
      if (/insufficient|credit|balance|quota/i.test(msg)) {
        return "OpenRouter free quota/credits are exhausted for this key. Try a different free model or a new key.";
      }
      return "OpenRouter rate limit reached. Please wait and retry.";
    }

    details = msg || details;
  } catch {}

  return details;
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

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
    if (!apiKey) {
      return Response.json(
        { error: "OPENROUTER_API_KEY not configured on the server" },
        { status: 500 }
      );
    }

    const promptText = code;

    let resp = await callOpenRouter({
      apiKey,
      model,
      promptText,
    });

    if (!resp.ok) {
      const firstErrBody = await resp.text();
      console.error("OpenRouter API error:", resp.status, firstErrBody);

      // If selected model is unavailable/blocked, try free fallback models.
      const modelIssue = /model|not found|not available|unavailable|unsupported/i.test(firstErrBody);
      if (modelIssue) {
        for (const fallbackModel of OPENROUTER_FREE_FALLBACK_MODELS) {
          if (fallbackModel === model) continue;
          const retryResp = await callOpenRouter({
            apiKey,
            model: fallbackModel,
            promptText,
          });
          if (retryResp.ok) {
            resp = retryResp;
            break;
          }
        }
      }

      if (!resp.ok) {
        const details = mapOpenRouterError(firstErrBody);
        return Response.json({ error: details }, { status: 502 });
      }
    }

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("OpenRouter API error:", resp.status, errBody);
      const details = mapOpenRouterError(errBody);
      return Response.json({ error: details }, { status: 502 });
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      console.error("OpenRouter API error: empty response", data);
      return Response.json(
        { error: "Model returned an empty response. Try again or switch model." },
        { status: 502 }
      );
    }

    const cleaned = text.replace(/```json|```/g, "").trim();
    const jsonCandidate = cleaned.startsWith("{") ? cleaned : extractFirstJsonObject(cleaned);

    if (!jsonCandidate) {
      return Response.json(
        { error: "Model returned non-JSON output. Please try again." },
        { status: 502 }
      );
    }

    let result;
    try {
      result = JSON.parse(jsonCandidate);
    } catch {
      console.error("OpenRouter API error: invalid JSON payload", cleaned.slice(0, 500));
      return Response.json(
        { error: "Model returned non-JSON output. Please try again." },
        { status: 502 }
      );
    }

    return Response.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return Response.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
