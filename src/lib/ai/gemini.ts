// Gemini 2.5 Pro client. Single-shot non-streaming generate. Throws clear
// errors on missing key, non-2xx response, or empty completion so callers can
// surface the failure verbatim instead of returning silent empty strings.

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

export async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json() as GeminiResponse;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no text. Response: ${JSON.stringify(data).slice(0, 500)}`);

  return text;
}

// Same model + endpoint as generateWithGemini, but with responseMimeType
// "application/json" so Gemini emits raw JSON instead of free-form text.
// Used by the AI Insights v2 pipeline. Default maxOutputTokens=16384 since
// the schema-driven response is significantly larger than v1 prose
// (scorecard + 5 themes + competitive table + catchment block + recommendations).
//
// Returns the raw response string. Caller is responsible for fence-stripping
// (Gemini occasionally still wraps in ```json...``` despite responseMimeType)
// and JSON.parse + schema validation.
export async function generateJSONWithGemini(
  prompt: string,
  options: { maxOutputTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: options.maxOutputTokens ?? 16384,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json() as GeminiResponse;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no text. Response: ${JSON.stringify(data).slice(0, 500)}`);

  return text;
}
