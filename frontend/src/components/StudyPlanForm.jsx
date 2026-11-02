
import { useState } from "react";

function StudyPlanForm() {
  const [subjects, setSubjects] = useState("");
  const [examDate, setExamDate] = useState("");
  const [hours, setHours] = useState("3");
  const [difficulty, setDifficulty] = useState("Medium");
  const [message, setMessage] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    const studyData = {
      subjects: subjects
        .split(",")
        .map((subject) => subject.trim())
        .filter(Boolean),
      examDate,
      hours: Number(hours),
      difficulty,
    };

    console.log("Study details:", studyData);
    setMessage("Your study details are ready!");
  }

  return (
    <form className="study-form" onSubmit={handleSubmit}>
      <h2>Create Your Study Plan</h2>

      <label htmlFor="subjects">Subjects</label>
      <input
        id="subjects"
        type="text"
        placeholder="Java, DBMS, Operating Systems"
        value={subjects}
        onChange={(event) => setSubjects(event.target.value)}
        required
      />

      <label htmlFor="examDate">Exam date</label>
      <input
        id="examDate"
        type="date"
        min={new Date().toLocaleDateString("en-CA")}
        value={examDate}
        onChange={(event) => setExamDate(event.target.value)}
        required
      />

      <label htmlFor="hours">Daily study hours</label>
      <select
        id="hours"
        value={hours}
        onChange={(event) => setHours(event.target.value)}
      >
        <option value="1">1 hour</option>
        <option value="2">2 hours</option>
        <option value="3">3 hours</option>
        <option value="4">4 hours</option>
        <option value="5">5 hours</option>
        <option value="6">6 hours</option>
      </select>

      <label htmlFor="difficulty">Difficulty level</label>
      <select
        id="difficulty"
        value={difficulty}
        onChange={(event) => setDifficulty(event.target.value)}
      >
        <option>Easy</option>
        <option>Medium</option>
        <option>Hard</option>
      </select>

      <button type="submit">Prepare My Study Plan</button>

      {message && <p className="success-message">{message}</p>}
    </form>
  );
}

export default StudyPlanForm;
