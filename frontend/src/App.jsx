
import { useEffect, useState } from "react";
import "./App.css";
const API_URL = "http://localhost:5000/api/study";

function App() {
  const [subjects, setSubjects] = useState("");
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState("3");
  const [difficulty, setDifficulty] = useState("Medium");

  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [updatingTask, setUpdatingTask] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // YouTube video states
  const [videosByTopic, setVideosByTopic] = useState({});
  const [loadingVideoTopic, setLoadingVideoTopic] = useState("");

  const completedTasks =
    activePlan?.tasks?.filter((task) => task.completed).length || 0;

  const totalTasks = activePlan?.tasks?.length || 0;

  const progress =
    totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

  const now = new Date();

  const minimumDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  async function readResponse(response) {
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || "Request failed.");
    }

    return result;
  }

  // Load saved study plans
  async function loadPlans() {
    setLoadingPlans(true);

    try {
      const response = await fetch(`${API_URL}/plans`);
      const result = await readResponse(response);
      const loadedPlans = result.data || result.plans || [];

      setPlans(loadedPlans);

      setActivePlan((current) => {
        if (current) {
          const updated = loadedPlans.find(
            (plan) => plan._id === current._id
          );

          if (updated) return updated;
        }

        return loadedPlans[0] || null;
      });
    } catch (err) {
      setError(err.message || "Could not connect to the backend.");
    } finally {
      setLoadingPlans(false);
    }
  }

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create a new AI study plan
  async function createPlan(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const subjectList = [
        ...new Set(
          subjects
            .split(",")
            .map((subject) => subject.trim())
            .filter(Boolean)
        ),
      ];

      if (!subjectList.length) {
        throw new Error("Please enter at least one subject.");
      }

      if (!examDate || examDate < minimumDate) {
        throw new Error("Please select today or a future exam date.");
      }

      const response = await fetch(`${API_URL}/plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subjects: subjectList,
          examDate,
          dailyHours: Number(dailyHours),
          difficulty,
        }),
      });

      const result = await readResponse(response);
      const newPlan = result.data || result.plan;

      if (!newPlan?._id) {
        throw new Error("Backend did not return the created study plan.");
      }

      setPlans((previous) => [
        newPlan,
        ...previous.filter((plan) => plan._id !== newPlan._id),
      ]);

      setActivePlan(newPlan);
      setSubjects("");
      setMessage("Your AI-powered study plan has been created!");
    } catch (err) {
      setError(err.message || "Unable to create your study plan.");
    } finally {
      setLoading(false);
    }
  }

  // Update task completion
  async function updateTask(taskId, completed) {
    if (!activePlan || !taskId) return;

    setUpdatingTask(taskId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/plans/${activePlan._id}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ completed }),
        }
      );

      const result = await readResponse(response);
      const updatedPlan = result.data || result.plan;

      if (!updatedPlan) {
        throw new Error("Backend did not return the updated plan.");
      }

      setPlans((previous) =>
        previous.map((plan) =>
          plan._id === updatedPlan._id ? updatedPlan : plan
        )
      );

      setActivePlan(updatedPlan);
      setMessage("Task updated successfully!");
    } catch (err) {
      setError(err.message || "Could not update the task.");
    } finally {
      setUpdatingTask("");
    }
  }

  // Delete a study plan
  async function deletePlan(planId) {
    if (!window.confirm("Delete this study plan permanently?")) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/plans/${planId}`, {
        method: "DELETE",
      });

      await readResponse(response);

      const remaining = plans.filter((plan) => plan._id !== planId);

      setPlans(remaining);

      if (activePlan?._id === planId) {
        setActivePlan(remaining[0] || null);
      }

      setMessage("Study plan deleted successfully!");
    } catch (err) {
      setError(err.message || "Could not delete the study plan.");
    }
  }

  // Search YouTube videos for a study topic
  async function searchVideos(topic) {
    if (!topic || loadingVideoTopic === topic) return;

    // Avoid requesting the same topic again if results are cached
    if (Object.prototype.hasOwnProperty.call(videosByTopic, topic)) {
      return;
    }

    setLoadingVideoTopic(topic);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/youtube?topic=${encodeURIComponent(topic)}`
      );

      const result = await readResponse(response);

      setVideosByTopic((previous) => ({
        ...previous,
        [topic]: result.videos || [],
      }));
    } catch (err) {
      setError(err.message || "Could not load YouTube videos.");
    } finally {
      setLoadingVideoTopic("");
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">📚 StudyMate AI</div>
          <p>Your personal smart study planner</p>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div className="hero-content">
            <span className="hero-tag">YOUR AI STUDY ASSISTANT</span>

            <h1>
              Plan smarter.
              <br />
              <span>Study better.</span>
            </h1>

            <p>
              Organize your subjects, create a personalized timetable,
              and track your exam preparation in one place.
            </p>

            <div className="hero-stats">
              <div className="stat">
                <strong>{plans.length}</strong>
                <span>Study Plans</span>
              </div>

              <div className="stat">
                <strong>{completedTasks}</strong>
                <span>Tasks Completed</span>
              </div>

              <div className="stat">
                <strong>{progress}%</strong>
                <span>Current Progress</span>
              </div>
            </div>
          </div>
        </section>

        {message && (
          <div className="message" role="status">
            ✅ {message}
          </div>
        )}

        {error && (
          <div className="error" role="alert">
            ⚠️ {error}
          </div>
        )}

        <section className="card create-card">
          <div className="section-heading">
            <span className="section-icon">✨</span>
            <div>
              <h2>Create Your Study Plan</h2>
              <p>Enter your exam details to generate your timetable.</p>
            </div>
          </div>

          <form onSubmit={createPlan}>
            <div className="form-group">
              <label htmlFor="subjects">Subjects</label>
              <input
                id="subjects"
                type="text"
                placeholder="e.g. Java, Python, DBMS"
                value={subjects}
                onChange={(event) => setSubjects(event.target.value)}
                required
              />
              <small>Separate multiple subjects with commas.</small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="examDate">Exam Date</label>
                <input
                  id="examDate"
                  type="date"
                  min={minimumDate}
                  value={examDate}
                  onChange={(event) => setExamDate(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="dailyHours">Study Hours Per Day</label>
                <input
                  id="dailyHours"
                  type="number"
                  min="1"
                  max="16"
                  value={dailyHours}
                  onChange={(event) => setDailyHours(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="difficulty">Difficulty Level</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Generating your study plan..."
                : "✨ Generate AI Study Plan"}
            </button>

            {loading && (
              <p className="loading-text">
                AI is preparing your personalized timetable. Please wait.
              </p>
            )}
          </form>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <span className="section-icon">📅</span>
            <div>
              <h2>Your Study Dashboard</h2>
              <p>Choose a saved plan to view its timetable.</p>
            </div>
          </div>

          {loadingPlans ? (
            <div className="empty-state">
              <p>Loading your saved study plans...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="empty-state">
              <span>📝</span>
              <h3>No study plans yet</h3>
              <p>Create your first plan using the form above.</p>
            </div>
          ) : (
            <div className="plan-list">
              {plans.map((plan) => (
                <button
                  type="button"
                  key={plan._id}
                  className={`plan-item ${
                    activePlan?._id === plan._id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setActivePlan(plan);
                    setMessage("");
                    setError("");
                  }}
                >
                  <span className="plan-item-icon">📘</span>
                  <span className="plan-item-text">
                    <strong>
                      {plan.title || plan.subjects?.join(", ") || "Study Plan"}
                    </strong>
                    <small>{plan.subjects?.length || 0} subjects</small>
                  </span>
                  <span className="plan-arrow">›</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {activePlan && (
          <section className="card plan-details">
            <div className="plan-heading">
              <div>
                <span className="section-label">YOUR SELECTED PLAN</span>
                <h2>{activePlan.title || "Your Study Plan"}</h2>

                <p>
                  Subjects: {activePlan.subjects?.join(", ") || "Not specified"}
                </p>

                <p>
                  Exam date: {activePlan.examDate || "Not specified"}
                </p>

                <p>
                  Daily study time: {activePlan.dailyHours || 3} hours
                </p>
              </div>

              <button
                type="button"
                className="delete-button"
                onClick={() => deletePlan(activePlan._id)}
              >
                🗑 Delete Plan
              </button>
            </div>

            <div className="progress-section">
              <div className="progress-heading">
                <div>
                  <h3>Learning Progress</h3>
                  <p>
                    {completedTasks} of {totalTasks} tasks completed
                  </p>
                </div>
                <strong>{progress}%</strong>
              </div>

              <div
                className="progress-bar"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="timetable-heading">
              <h3>📖 Your Timetable</h3>
              <p>Tick each task after completing it.</p>
            </div>

            {!activePlan.tasks?.length ? (
              <div className="empty-state">
                <p>No tasks available in this plan yet.</p>
              </div>
            ) : (
              <div className="task-list">
                {activePlan.tasks.map((task, index) => {
                  const topic = task.topic || task.subject;
                  const videos = videosByTopic[topic];

                  return (
                    <div
                      className={`task-item ${
                        task.completed ? "task-completed" : ""
                      }`}
                      key={task._id || `${task.subject}-${index}`}
                    >
                      <label className="task-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(task.completed)}
                          disabled={updatingTask === task._id}
                          onChange={(event) =>
                            updateTask(task._id, event.target.checked)
                          }
                        />
                      </label>

                      <div className="task-content">
                        <strong>{topic}</strong>
                        <p>Subject: {task.subject || "Not specified"}</p>

                        <div className="task-meta">
                          <span>📅 {task.date || "Date not set"}</span>
                          <span>🕒 {task.startTime || "Time not set"}</span>
                          <span>⏱ {task.duration || 30} minutes</span>
                        </div>

                        {/* YouTube learning videos */}
                        <div className="youtube-section">
                          <button
                            type="button"
                            className="video-button"
                            onClick={() => searchVideos(topic)}
                            disabled={loadingVideoTopic === topic}
                          >
                            {loadingVideoTopic === topic
                              ? "Loading videos..."
                              : "▶ Find Learning Videos"}
                          </button>

                          {videos && videos.length === 0 && (
                            <p>No videos found for this topic.</p>
                          )}

                          {videos && videos.length > 0 && (
                            <div className="youtube-videos">
                              {videos.map((video) => (
                                <p key={video.url}>
                                  <a
                                    href={video.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    ▶ {video.title}
                                  </a>
                                  <small> — {video.channel}</small>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        {updatingTask === task._id && (
                          <small>Updating task...</small>
                        )}
                      </div>

                      <span className="task-status">
                        {task.completed ? "Completed ✓" : "Pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <p>StudyMate AI © {new Date().getFullYear()}</p>
        <span>Plan your learning. Achieve your goals.</span>
      </footer>
    </div>
  );
}

export default App;
