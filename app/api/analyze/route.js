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

function validateCodeStructure(code) {
  const src = code.replace(/\r\n/g, "\n").trim();
  if (src.length < 8) {
    return "Code is too short to analyze.";
  }

  // Fast signal that input resembles C/C++ code.
  const hasCppSignals =
    /#include\s*[<"]/m.test(src) ||
    /\b(int|void|char|float|double|long|short|bool|string|class|struct|template|namespace|using|auto|constexpr|typename|std)\b/.test(src) ||
    /\b(for|while|do|if|else|switch|case|return|cout|cin|printf|scanf)\b/.test(src) ||
    /[;{}()]/.test(src);

  if (!hasCppSignals) {
    return "Input does not look like valid C/C++ code.";
  }

  let sanitized;
  try {
    sanitized = stripCommentsAndStrings(src);
  } catch (err) {
    return err.message || "Invalid code syntax.";
  }

  const stack = [];
  const pairs = { ")": "(", "}": "{", "]": "[" };

  let lineNo = 1;
  for (let i = 0; i < sanitized.length; i += 1) {
    const ch = sanitized[i];
    if (ch === "\n") {
      lineNo += 1;
      continue;
    }

    if (ch === "(" || ch === "{" || ch === "[") {
      stack.push({ ch, line: lineNo });
      continue;
    }

    if (ch === ")" || ch === "}" || ch === "]") {
      const top = stack.pop();
      if (!top || top.ch !== pairs[ch]) {
        return `Syntax error near line ${lineNo}: unbalanced brackets or parentheses.`;
      }
    }
  }

  if (stack.length > 0) {
    const last = stack[stack.length - 1];
    return `Syntax error near line ${last.line}: missing closing token for '${last.ch}'.`;
  }

  const lines = sanitized.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    const lineNo = i + 1;

    if (!line || line.startsWith("#")) continue;

    if (/\b(for|if|while|switch)\b/.test(line) && !/\b(for|if|while|switch)\s*\(/.test(line)) {
      return `Syntax error near line ${lineNo}: control statement is missing parentheses.`;
    }

    for (const match of line.matchAll(/\bfor\s*\(([^)]*)\)/g)) {
      const header = match[1];
      const semicolonCount = (header.match(/;/g) || []).length;
      if (semicolonCount !== 2) {
        return `Syntax error near line ${lineNo}: for-loop header must contain exactly two ';'.`;
      }
    }

    if (/^\s*case\b/.test(line) && !/:\s*$/.test(line)) {
      return `Syntax error near line ${lineNo}: case label must end with ':'.`;
    }

    if (/\b(return|break|continue|throw)\b/.test(line) && !/;\s*$/.test(line)) {
      return `Syntax error near line ${lineNo}: missing ';' after statement.`;
    }
  }

  const lastSignificant = lines
    .map((v) => v.trim())
    .filter((v) => v && !v.startsWith("#"))
    .pop();

  if (lastSignificant && /(?:[+\-*/%&|^=!<>]|\?|:)\s*$/.test(lastSignificant)) {
    return "Incomplete code: expression appears to end with an operator.";
  }

  if (/\b(for|if|while|switch)\s*\([^)]*$/m.test(sanitized)) {
    return "Incomplete code: missing ')' in control statement.";
  }

  if (/\b(do|else)\s*$/.test(lastSignificant || "")) {
    return "Incomplete code: dangling control keyword at the end.";
  }

  return null;
}

function stripCommentsAndStrings(input) {
  let out = "";
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    const prev = input[i - 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        out += "\n";
      } else {
        out += " ";
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        out += "  ";
        i += 1;
      } else {
        out += ch === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (!inSingle && !inDouble && ch === "/" && next === "/") {
      inLineComment = true;
      out += "  ";
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble && ch === "/" && next === "*") {
      inBlockComment = true;
      out += "  ";
      i += 1;
      continue;
    }

    if (!inDouble && ch === "'" && prev !== "\\") {
      inSingle = !inSingle;
      out += " ";
      continue;
    }

    if (!inSingle && ch === '"' && prev !== "\\") {
      inDouble = !inDouble;
      out += " ";
      continue;
    }

    if (inSingle || inDouble) {
      out += ch === "\n" ? "\n" : " ";
      continue;
    }

    out += ch;
  }

  if (inSingle || inDouble) {
    throw new Error("Invalid code: unterminated string or character literal.");
  }

  if (inBlockComment) {
    throw new Error("Invalid code: unterminated block comment.");
  }

  return out;
}

function validateAnalyzerResultShape(result) {
  if (!result || typeof result !== "object") return false;

  const hasComplexity =
    typeof result.timeComplexity === "string" &&
    /^O\s*\(.+\)$/i.test(result.timeComplexity.trim()) &&
    typeof result.spaceComplexity === "string" &&
    /^O\s*\(.+\)$/i.test(result.spaceComplexity.trim());

  return hasComplexity;
}

function extractFirstJsonObject(text) {
  // Remove markdown code fences first
  let cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
  
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

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
        return cleaned.slice(start, i + 1);
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

    const validationError = validateCodeStructure(code);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
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

    const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
    const jsonCandidate = cleaned.startsWith("{") ? cleaned : extractFirstJsonObject(cleaned);

    if (!jsonCandidate) {
      console.error("OpenRouter API error: no JSON found in response:", text.slice(0, 500));
      return Response.json(
        { error: "Model returned non-JSON output. Try a different model or check your prompt." },
        { status: 502 }
      );
    }

    let result;
    try {
      result = JSON.parse(jsonCandidate);
    } catch (parseErr) {
      console.error("OpenRouter API error: invalid JSON payload:", jsonCandidate.slice(0, 300), "Error:", parseErr.message);
      return Response.json(
        { error: `Invalid JSON output: ${parseErr.message}. Try again or switch models.` },
        { status: 502 }
      );
    }

    if (!validateAnalyzerResultShape(result)) {
      return Response.json(
        { error: "Invalid code analysis output. Please submit syntactically valid C/C++ code." },
        { status: 422 }
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
