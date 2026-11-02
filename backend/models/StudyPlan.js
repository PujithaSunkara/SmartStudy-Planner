const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const studyPlanSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subjects: {
      type: [String],
      required: true,
      validate: {
        validator: (subjects) => subjects.length > 0,
        message: "At least one subject is required.",
      },
    },
    examDate: {
      type: String,
      required: true,
    },
    dailyHours: {
      type: Number,
      required: true,
      min: 1,
      max: 16,
      default: 3,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    tasks: {
      type: [taskSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.StudyPlan ||
  mongoose.model("StudyPlan", studyPlanSchema);