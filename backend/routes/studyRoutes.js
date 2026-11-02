const express = require("express");
const mongoose = require("mongoose");
const { GoogleGenAI, Type } = require("@google/genai");
const StudyPlan = require("../models/StudyPlan");

const router = express.Router();

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;
const MODEL_NAME = "gemini-3.5-flash-lite";

// Format a date as YYYY-MM-DD using local time
function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Validate a date without timezone conversion
function parseDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || "")) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function cleanSubjects(subjects) {
  if (!Array.isArray(subjects)) return [];

  return [
    ...new Set(
      subjects
        .filter((subject) => typeof subject === "string")
        .map((subject) => subject.trim())
        .filter(Boolean)
    ),
  ];
}

// Remove duplicate topics within each subject
function cleanTopics(topics, subject) {
  const seen = new Set();

  return topics
    .filter((topic) => typeof topic === "string")
    .map((topic) => topic.trim())
    .filter((topic) => {
      const key = topic.toLowerCase();

      if (!topic || seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .map((topic) => ({ subject, topic }));
}

// Retry Gemini requests when the service is temporarily unavailable
async function generateTopics(subjects, difficulty) {
  if (!ai) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it to backend/.env and restart the backend."
    );
  }

  const topicsPerSubject = 8;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `
Generate study topics for exam preparation.

Subjects: ${subjects.join(", ")}
Difficulty: ${difficulty}

Requirements:
- Generate ${topicsPerSubject} distinct topics for EACH subject.
- Every topic must be relevant to its subject.
- Avoid duplicate topics within a subject.
- Use clear and concise topic names.
- Return JSON only.
`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subjects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    subject: { type: Type.STRING },
                    topics: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ["subject", "topics"],
                },
              },
            },
            required: ["subjects"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      const returnedSubjects = Array.isArray(parsed.subjects)
        ? parsed.subjects
        : [];

      const result = [];

      for (const subject of subjects) {
        const match = returnedSubjects.find(
          (item) =>
            typeof item.subject === "string" &&
            item.subject.trim().toLowerCase() === subject.toLowerCase()
        );

        const topics = cleanTopics(
          Array.isArray(match?.topics) ? match.topics : [],
          subject
        );

        if (topics.length === 0) {
          throw new Error(
            `AI did not generate topics for "${subject}". Please try again.`
          );
        }

        result.push(...topics);
      }

      return result;
    } catch (error) {
      const errorText = [
        error.message,
        error.status,
        error.code,
      ].join(" ");

      const isTemporary =
        /503|UNAVAILABLE|high demand|429|RESOURCE_EXHAUSTED|500|INTERNAL|502|504/i.test(
          errorText
        );

      if (!isTemporary || attempt === maxAttempts) {
        if (isTemporary) {
          throw new Error(
            "Gemini AI is temporarily busy or its quota is exhausted. Please wait and try again."
          );
        }

        throw error;
      }

      const delay = attempt * 2000;

      console.log(
        `Gemini temporarily unavailable. Attempt ${attempt + 1}/${maxAttempts} in ${delay / 1000} seconds.`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Unable to generate study topics. Please try again.");
}

// Generate a timetable with unique topics and realistic durations
function createTimetable(topicItems, examDate, dailyHours) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exam = parseDate(examDate);

  if (!exam) {
    throw new Error("Please provide a valid exam date.");
  }

  if (exam < today) {
    throw new Error("Exam date cannot be in the past.");
  }

  const availableDays =
    Math.floor((exam.getTime() - today.getTime()) / 86400000) + 1;

  const slotsPerDay = Math.max(1, Math.floor(dailyHours));
  const totalSlots = availableDays * slotsPerDay;

  if (topicItems.length > totalSlots) {
    throw new Error(
      `You need ${topicItems.length} study sessions, but only ${totalSlots} fit before the exam at ${dailyHours} sessions per day. Choose a later exam date, increase daily hours, or reduce subjects.`
    );
  }

  // Split daily study time among the selected sessions.
  const minutesPerTask = Math.max(
    30,
    Math.floor((dailyHours * 60) / slotsPerDay)
  );

  const tasks = [];

  topicItems.forEach((item, index) => {
    const dayOffset = Math.floor(index / slotsPerDay);
    const slotIndex = index % slotsPerDay;

    const taskDate = new Date(today);
    taskDate.setDate(taskDate.getDate() + dayOffset);

    // Spread sessions across the day.
    const startHour = 9 + slotIndex * Math.floor(8 / slotsPerDay);
    const hour = Math.min(startHour, 20);

    tasks.push({
      subject: item.subject,
      topic: item.topic,
      date: getLocalDateString(taskDate),
      startTime: `${String(hour).padStart(2, "0")}:00`,
      duration: minutesPerTask,
      completed: false,
    });
  });

  return tasks;
}

// POST /api/study/plans
router.post("/plans", async (req, res) => {
  try {
    const subjects = cleanSubjects(req.body.subjects);
    const examDate = req.body.examDate;
    const dailyHours = Number(req.body.dailyHours);
    const difficulty = req.body.difficulty || "Medium";

    if (subjects.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Enter at least one subject.",
      });
    }

    if (
      !Number.isInteger(dailyHours) ||
      dailyHours < 1 ||
      dailyHours > 16
    ) {
      return res.status(400).json({
        success: false,
        message: "Daily study hours must be between 1 and 16.",
      });
    }

    if (!["Easy", "Medium", "Hard"].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: "Difficulty must be Easy, Medium, or Hard.",
      });
    }

    const exam = parseDate(examDate);

    if (!exam) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid exam date.",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (exam < today) {
      return res.status(400).json({
        success: false,
        message: "Exam date cannot be in the past.",
      });
    }

    const topicItems = await generateTopics(subjects, difficulty);
    const tasks = createTimetable(topicItems, examDate, dailyHours);

    const plan = await StudyPlan.create({
      title: `${subjects.join(", ")} Study Plan`,
      subjects,
      examDate,
      dailyHours,
      difficulty,
      tasks,
    });

    return res.status(201).json({
      success: true,
      message: "AI-powered study plan created successfully!",
      data: plan,
    });
  } catch (error) {
    console.error("Create study plan error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Unable to create the study plan. Please try again.",
    });
  }
});

// GET /api/study/plans
router.get("/plans", async (req, res) => {
  try {
    const plans = await StudyPlan.find().sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: plans.length,
      data: plans,
    });
  } catch (error) {
    console.error("Load study plans error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load study plans.",
    });
  }
});

// PATCH /api/study/plans/:planId/tasks/:taskId
router.patch("/plans/:planId/tasks/:taskId", async (req, res) => {
  try {
    const { planId, taskId } = req.params;
    const { completed } = req.body;

    if (
      !mongoose.isValidObjectId(planId) ||
      !mongoose.isValidObjectId(taskId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan or task ID.",
      });
    }

    if (typeof completed !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Completed must be true or false.",
      });
    }

    const plan = await StudyPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Study plan not found.",
      });
    }

    const task = plan.tasks.id(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    task.completed = completed;
    await plan.save();

    return res.json({
      success: true,
      message: "Task updated successfully.",
      data: plan,
    });
  } catch (error) {
    console.error("Update task error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update the task.",
    });
  }
});

// DELETE /api/study/plans/:planId
router.delete("/plans/:planId", async (req, res) => {
  try {
    const { planId } = req.params;

    if (!mongoose.isValidObjectId(planId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid study plan ID.",
      });
    }

    const plan = await StudyPlan.findByIdAndDelete(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Study plan not found.",
      });
    }

    return res.json({
      success: true,
      message: "Study plan deleted successfully.",
    });
  } catch (error) {
    console.error("Delete study plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete the study plan.",
    });
  }
});

router.get("/youtube", async (req, res) => {
  try {
    const topic = req.query.topic;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: "Please provide a topic",
      });
    }

    const params = new URLSearchParams({
      part: "snippet",
      q: `${topic} tutorial`,
      type: "video",
      maxResults: "5",
      key: process.env.YOUTUBE_API_KEY,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`
    );

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: result.error?.message || "YouTube API failed",
      });
    }

    const videos = result.items.map((item) => ({
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));

    res.json({ success: true, videos });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch videos",
    });
  }
});


module.exports = router;