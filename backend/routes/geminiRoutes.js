
const express = require("express");
const router = express.Router();

router.post("/generate-topics", async (req, res) => {
  try {
    // 1. Check whether the API key exists
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Gemini API key is missing. Check backend/.env",
      });
    }

    // 2. Read data sent by the frontend or API tester
    const { subjects, difficulty = "Medium" } = req.body;

    if (
      !Array.isArray(subjects) ||
      subjects.length === 0 ||
      subjects.some(
        (subject) =>
          typeof subject !== "string" || !subject.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a non-empty subjects array.",
      });
    }

    // 3. Load the Google Gemini SDK
    const { GoogleGenAI } = await import("@google/genai");

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // 4. Tell Gemini exactly what we want
    const prompt = `
You are an expert academic study planner.

Generate 5 useful study topics for each of these subjects:
${subjects.map((subject) => `- ${subject.trim()}`).join("\n")}

Difficulty level: ${difficulty}

Rules:
- Topics must be specific to each subject.
- Avoid generic topics like "Study and revise".
- Topics should be appropriate for a college student.
- Do not invent a syllabus or claim these are official syllabus topics.
- Return valid JSON only, matching the required schema.
`;

    // 5. Send the prompt to Gemini
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              subject: { type: "string" },
              topics: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["subject", "topics"],
          },
        },
      },
    });

    // 6. Convert Gemini's JSON response into JavaScript data
    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    const generatedTopics = JSON.parse(response.text);

    // 7. Send the result back to the caller
    return res.status(200).json({
      success: true,
      message: "Study topics generated successfully!",
      data: generatedTopics,
    });
  } catch (error) {
    console.error("Gemini API error:", error.message);

    return res.status(500).json({
      success: false,
      message:
        "Unable to generate topics. Check the API key, model availability, quota, and backend logs.",
    });
  }
});

module.exports = router;
