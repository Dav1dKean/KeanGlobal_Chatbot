import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";

const PROGRAMS = [
  { name: "Computer Science (MS)", level: "Graduate", area: "STEM", tags: ["AI", "Systems", "Data"] },
  { name: "Computer Science (BS)", level: "Undergraduate", area: "STEM", tags: ["Programming", "Algorithms"] },
  { name: "Data Analytics (MS)", level: "Graduate", area: "STEM", tags: ["BI", "Mining", "ML"] },
  { name: "Cybersecurity (MS)", level: "Graduate", area: "STEM", tags: ["Network", "Security"] },
  { name: "Business Administration (MBA)", level: "Graduate", area: "Business", tags: ["Management"] },
  { name: "Psychology (BA)", level: "Undergraduate", area: "Arts & Sciences", tags: ["Behavior"] },
];

export default function ProgramsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("All");

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return PROGRAMS.filter((p) => {
      const matchQ =
        !keyword ||
        p.name.toLowerCase().includes(keyword) ||
        p.tags.some((t) => t.toLowerCase().includes(keyword)) ||
        p.area.toLowerCase().includes(keyword);

      const matchLevel = level === "All" || p.level === level;
      return matchQ && matchLevel;
    });
  }, [q, level]);

  return (
        <div className="porgrams">
        <section className="hero">
            <div className="hero-full">
                <div className="hero-video-wrap">
                <video
                    className="hero-video"
                    src="/media/hero.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                />
                <div className="hero-overlay">
                    <h1 className="hero-title">Majors &amp; Degree Programs</h1>
                    
                    <div className="hero-actions">
                    <button className="hero-btn" onClick={() => navigate("/programs")}>
                        let me think what to put
                    </button>

                    <button className="hero-btn" onClick={() => navigate("/chat")}>
                        I dont know yet
                    </button>
                    </div>
                </div>
                </div>
            </div>
        </section>

      <div className="programs-header">
        <h1 className="programs-title">Majors & Degree Programs</h1>
        <p className="programs-subtitle">
          Browse programs. Use search to quickly filter by major name or keywords.
        </p>

        <div className="programs-controls">
          <input
            className="programs-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search (e.g., Computer Science, Data, Security)..."
          />

          <select
            className="programs-select"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="All">All levels</option>
            <option value="Undergraduate">Undergraduate</option>
            <option value="Graduate">Graduate</option>
          </select>
        </div>
      </div>

      <div className="programs-grid">
        {filtered.map((p) => (
          <div key={p.name} className="program-card">
            <div className="program-card-top">
              <div className="program-name">{p.name}</div>
              <div className="program-meta">
                <span className="pill">{p.level}</span>
                <span className="pill">{p.area}</span>
              </div>
            </div>

            <div className="program-tags">
              {p.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>

            <div className="program-actions">
              <button
                className="btn-secondary"
                onClick={() => alert(`TODO: Open details for: ${p.name}`)}
              >
                View Details
              </button>
              <button
                className="btn-secondary"
                onClick={() => alert(`TODO: Request info for: ${p.name}`)}
              >
                Request Info
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="program-empty">
            No programs found. Try another keyword.
          </div>
        )}
      </div>
    </div>
  );
}
