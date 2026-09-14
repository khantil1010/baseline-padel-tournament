"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FormatId = "normal" | "playoff";

type ScoringFormat = {
  id: FormatId;
  name: string;
  description: string;
  targetSets: number;
  bestOfSets: number;
};

type Team = {
  name: string;
  player1: string;
  player2: string;
};

type PointValue = 0 | 15 | 30 | 40 | 60;

type SetScore = {
  a: number;
  b: number;
};

type CurrentSet = {
  a: PointValue;
  b: PointValue;
  advantage: "a" | "b" | null;
  deuceCount: number;
};

type Match = {
  id: string;
  name: string;
  teamA: Team;
  teamB: Team;
  formatId: FormatId;
  status: "live" | "completed";
  sets: SetScore[];
  current: CurrentSet;
  winner: "a" | "b" | null;
  createdAt: string;
  history?: MatchHistory[];
};

type MatchHistory = {
  sets: SetScore[];
  current: CurrentSet;
  winner: "a" | "b" | null;
  status: "live" | "completed";
};

type Tournament = {
  id: string;
  name: string;
  createdAt: string;
  matches: Match[];
};

const STORAGE_KEY = "baseline-simple-padel-manager-v1";

const FORMATS: ScoringFormat[] = [
  {
    id: "normal",
    name: "Normal match · Race to 4 sets",
    description: "First team to win 4 sets. Best of 7 sets.",
    targetSets: 4,
    bestOfSets: 7
  },
  {
    id: "playoff",
    name: "Playoff match · Race to 6 sets",
    description: "First team to win 6 sets. Best of 11 sets.",
    targetSets: 6,
    bestOfSets: 11
  }
];

const EMPTY_CURRENT_SET: CurrentSet = {
  a: 0,
  b: 0,
  advantage: null,
  deuceCount: 0
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createInitialTournaments(): Tournament[] {
  return [
    {
      id: makeId(),
      name: "August Tournament",
      createdAt: new Date().toISOString(),
      matches: []
    },
    {
      id: makeId(),
      name: "Sunday League",
      createdAt: new Date().toISOString(),
      matches: []
    }
  ];
}

function getFormat(id: FormatId) {
  return FORMATS.find(format => format.id === id) || FORMATS[0];
}

function nextPoint(value: PointValue): PointValue {
  if (value === 0) return 15;
  if (value === 15) return 30;
  if (value === 30) return 40;
  return 60;
}

function getPointLabel(value: PointValue) {
  return String(value);
}

function teamLabel(team: Team) {
  return `${team.name} · ${team.player1} + ${team.player2}`;
}

function getSetWinnerCount(sets: SetScore[], side: "a" | "b") {
  return sets.filter(set => {
    if (side === "a") return set.a > set.b;
    return set.b > set.a;
  }).length;
}

function scorePoint(
  match: Match,
  side: "a" | "b"
): {
  match: Match;
  completedSet: boolean;
} {
  const current = { ...match.current };

  /*
   * If both teams are at 40 and the third deuce has been reached,
   * the next point is a golden point.
   */
  if (
    current.a === 40 &&
    current.b === 40 &&
    current.advantage === null &&
    current.deuceCount >= 3
  ) {
    const completedSet: SetScore =
      side === "a"
        ? { a: 60, b: 40 }
        : { a: 40, b: 60 };

    const nextSets = [...match.sets, completedSet];
    const format = getFormat(match.formatId);
    const aSets = getSetWinnerCount(nextSets, "a");
    const bSets = getSetWinnerCount(nextSets, "b");

    const winner =
      aSets >= format.targetSets
        ? "a"
        : bSets >= format.targetSets
          ? "b"
          : null;

    return {
      completedSet: true,
      match: {
        ...match,
        sets: nextSets,
        current: { ...EMPTY_CURRENT_SET },
        status: winner ? "completed" : "live",
        winner
      }
    };
  }

  /*
   * If one team has advantage:
   * - Same team scores again: wins the set.
   * - Opponent scores: return to deuce and increase deuce count.
   */
  if (current.advantage !== null) {
    if (current.advantage === side) {
      const completedSet: SetScore =
        side === "a"
          ? { a: 60, b: 40 }
          : { a: 40, b: 60 };

      const nextSets = [...match.sets, completedSet];
      const format = getFormat(match.formatId);
      const aSets = getSetWinnerCount(nextSets, "a");
      const bSets = getSetWinnerCount(nextSets, "b");

      const winner =
        aSets >= format.targetSets
          ? "a"
          : bSets >= format.targetSets
            ? "b"
            : null;

      return {
        completedSet: true,
        match: {
          ...match,
          sets: nextSets,
          current: { ...EMPTY_CURRENT_SET },
          status: winner ? "completed" : "live",
          winner
        }
      };
    }

    current.advantage = null;
    current.deuceCount += 1;

    return {
      completedSet: false,
      match: {
        ...match,
        current
      }
    };
  }

  /*
   * When both reach 40, enter deuce.
   */
  if (current.a === 40 && current.b === 40) {
    if (current.deuceCount === 0) {
      current.deuceCount = 1;
    }

    current.advantage = side;

    return {
      completedSet: false,
      match: {
        ...match,
        current
      }
    };
  }

  /*
   * Normal scoring before deuce.
   */
  const updatedValue = nextPoint(current[side]);
  current[side] = updatedValue;

  /*
   * A team wins the set when it reaches 60, unless the other team
   * is also at 40, which creates deuce instead.
   */
  if (updatedValue === 60) {
    const completedSet: SetScore =
      side === "a"
        ? { a: 60, b: current.b }
        : { a: current.a, b: 60 };

    const nextSets = [...match.sets, completedSet];
    const format = getFormat(match.formatId);
    const aSets = getSetWinnerCount(nextSets, "a");
    const bSets = getSetWinnerCount(nextSets, "b");

    const winner =
      aSets >= format.targetSets
        ? "a"
        : bSets >= format.targetSets
          ? "b"
          : null;

    return {
      completedSet: true,
      match: {
        ...match,
        sets: nextSets,
        current: { ...EMPTY_CURRENT_SET },
        status: winner ? "completed" : "live",
        winner
      }
    };
  }

  /*
   * If the other team is already at 40 and this team has now reached
   * 40 as well, the next interaction will use deuce logic.
   */
  if (current.a === 40 && current.b === 40) {
    current.deuceCount = 1;
  }

  return {
    completedSet: false,
    match: {
      ...match,
      current
    }
  };
}

export default function Home() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(
    null
  );
  const [screen, setScreen] = useState<
    "home" | "tournament" | "setup" | "live"
  >("home");

  const screenRef = useRef(screen);

useEffect(() => {
  screenRef.current = screen;
}, [screen]);

  const [newTournamentName, setNewTournamentName] = useState("");
  const [formError, setFormError] = useState("");

const [matchName, setMatchName] = useState("");

const [teamA, setTeamA] = useState<Team>({
  name: "",
  player1: "",
  player2: ""
});

const [teamB, setTeamB] = useState<Team>({
  name: "",
  player1: "",
  player2: ""
});

const [formatId, setFormatId] = useState<FormatId>("normal");
const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        setTournaments(JSON.parse(saved));
        return;
      } catch {
        // If old/corrupt data exists, use fresh data below.
      }
    }

    setTournaments(createInitialTournaments());
  }, []);

  useEffect(() => {
    if (tournaments.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
    }
  }, [tournaments]);

useEffect(() => {
  const guardState = {
    baselineApp: true
  };

  // Add one protected browser-history entry.
  window.history.pushState(
    guardState,
    "",
    window.location.href
  );

  function handleBackButton() {
    // If the user is scoring, return to the tournament screen.
    if (screenRef.current === "live") {
      setScreen("tournament");
      setActiveMatchId(null);
    }

    // Immediately restore the protected history entry.
    // This prevents the browser from leaving or closing the app page.
    window.history.pushState(
      guardState,
      "",
      window.location.href
    );
  }

  window.addEventListener("popstate", handleBackButton);

  return () => {
    window.removeEventListener("popstate", handleBackButton);
  };
}, [screen]);

  const selectedTournament = useMemo(
    () =>
      tournaments.find(
        tournament => tournament.id === selectedTournamentId
      ) || null,
    [tournaments, selectedTournamentId]
  );

  const activeMatch = useMemo(() => {
    if (!selectedTournament || !activeMatchId) return null;

    return (
      selectedTournament.matches.find(match => match.id === activeMatchId) ||
      null
    );
  }, [selectedTournament, activeMatchId]);

  function openTournament(id: string) {
    setSelectedTournamentId(id);
    setScreen("tournament");
    setFormError("");
  }

  function createTournament() {
    const name = newTournamentName.trim();

    if (!name) {
      setFormError("Please enter a tournament name.");
      return;
    }

    const tournament: Tournament = {
      id: makeId(),
      name,
      createdAt: new Date().toISOString(),
      matches: []
    };

    setTournaments(current => [...current, tournament]);
    setNewTournamentName("");
    setFormError("");
    setSelectedTournamentId(tournament.id);
    setScreen("tournament");
  }

function openSetup() {
  setMatchName("");
  setTeamA({ name: "", player1: "", player2: "" });
  setTeamB({ name: "", player1: "", player2: "" });
  setFormatId("normal");
  setFormError("");
  setScreen("setup");
}

  function startMatch() {
    if (!selectedTournament) return;

if (!matchName.trim()) {
  setFormError("Please enter a match name.");
  return;
}

if (
  !teamA.name.trim() ||
  !teamA.player1.trim() ||
  !teamA.player2.trim() ||
  !teamB.name.trim() ||
  !teamB.player1.trim() ||
  !teamB.player2.trim()
) {
  setFormError("Please complete both team names and both players.");
  return;
}

    if (teamA.name.trim().toLowerCase() === teamB.name.trim().toLowerCase()) {
      setFormError("Team A and Team B must have different names.");
      return;
    }

const match: Match = {
  id: makeId(),
  name: matchName.trim(),
  teamA: {
        name: teamA.name.trim(),
        player1: teamA.player1.trim(),
        player2: teamA.player2.trim()
      },
      teamB: {
        name: teamB.name.trim(),
        player1: teamB.player1.trim(),
        player2: teamB.player2.trim()
      },
      formatId,
      status: "live",
      sets: [],
current: { ...EMPTY_CURRENT_SET },
winner: null,
createdAt: new Date().toISOString(),
history: []
    };

    setTournaments(current =>
      current.map(tournament =>
        tournament.id === selectedTournament.id
          ? {
              ...tournament,
              matches: [...tournament.matches, match]
            }
          : tournament
      )
    );

    setActiveMatchId(match.id);
    setScreen("live");
    setFormError("");
  }

  function updateActiveMatch(updatedMatch: Match) {
    if (!selectedTournament) return;

    setTournaments(current =>
      current.map(tournament =>
        tournament.id === selectedTournament.id
          ? {
              ...tournament,
              matches: tournament.matches.map(match =>
                match.id === updatedMatch.id ? updatedMatch : match
              )
            }
          : tournament
      )
    );
  }

function addPoint(side: "a" | "b") {
  if (!activeMatch || activeMatch.status === "completed") return;

  const previousSnapshot: MatchHistory = {
    sets: activeMatch.sets.map(set => ({ ...set })),
    current: {
      ...activeMatch.current
    },
    winner: activeMatch.winner,
    status: activeMatch.status
  };

  const result = scorePoint(activeMatch, side);

  const existingHistory = activeMatch.history || [];

  const updatedMatch: Match = {
    ...result.match,
    history: [...existingHistory, previousSnapshot]
  };

  updateActiveMatch(updatedMatch);
}

function undoLastPoint() {
  if (!activeMatch) return;

  const history = activeMatch.history || [];

  if (history.length === 0) return;

  const previousState = history[history.length - 1];
  const remainingHistory = history.slice(0, -1);

  const restoredMatch: Match = {
    ...activeMatch,
    sets: previousState.sets.map(set => ({ ...set })),
    current: {
      ...previousState.current
    },
    winner: previousState.winner,
    status: previousState.status,
    history: remainingHistory
  };

  updateActiveMatch(restoredMatch);
}

  function backToTournament() {
    setScreen("tournament");
    setActiveMatchId(null);
  }

  function formatPointDisplay(
    current: CurrentSet,
    side: "a" | "b"
  ) {
    if (current.advantage === side) return "AD";
    return getPointLabel(current[side]);
  }

  if (screen === "home") {
    return (
      <main className="app-shell">
        <Header />

        <section className="intro-section">
          <div className="eyebrow">PRIVATE PADEL MANAGER</div>
          <h1>Choose<br />tournament.</h1>
          <p className="intro-copy">
            Open an existing tournament or create a new one.
          </p>
        </section>

        <section className="panel-section">
          <div className="section-title-row">
            <div>
              <div className="eyebrow">TOURNAMENTS</div>
              <h2>Your tournaments</h2>
            </div>
          </div>

          <div className="tournament-list">
            {tournaments.map(tournament => (
              <button
                key={tournament.id}
                className="tournament-card"
                onClick={() => openTournament(tournament.id)}
              >
                <span className="tournament-card-name">
                  {tournament.name}
                </span>
                <span className="tournament-card-meta">
                  {tournament.matches.length} match
                  {tournament.matches.length === 1 ? "" : "es"}
                  <span>→</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel-section create-section">
          <div className="eyebrow">NEW</div>
          <h2>Create a tournament</h2>

          <div className="form-stack">
            <label className="field-label">
              Tournament name
              <input
                value={newTournamentName}
                onChange={event => setNewTournamentName(event.target.value)}
                placeholder="Example: September Tournament"
              />
            </label>

            {formError && <div className="error-message">{formError}</div>}

            <button className="primary-button" onClick={createTournament}>
              Create tournament
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "tournament" && selectedTournament) {
    return (
      <main className="app-shell">
        <Header />

        <button className="back-button" onClick={() => setScreen("home")}>
          ← All tournaments
        </button>

        <section className="intro-section compact">
          <div className="eyebrow">TOURNAMENT</div>
          <h1>{selectedTournament.name}</h1>
          <p className="intro-copy">
            Start a match and record every point from courtside.
          </p>
        </section>

        <section className="action-section">
          <button className="primary-button large-button" onClick={openSetup}>
            + Start match
          </button>
        </section>

        <section className="panel-section">
          <div className="section-title-row">
            <div>
              <div className="eyebrow">MATCH HISTORY</div>
              <h2>Matches</h2>
            </div>
          </div>

          {selectedTournament.matches.length === 0 ? (
            <div className="empty-state">
              No matches yet. Tap “Start match” to begin.
            </div>
          ) : (
            <div className="match-history-list">
              {[...selectedTournament.matches]
                .reverse()
                .map(match => {
                  const format = getFormat(match.formatId);
                  const aSets = getSetWinnerCount(match.sets, "a");
                  const bSets = getSetWinnerCount(match.sets, "b");

                  return (
                    <button
                      key={match.id}
                      className="history-card"
                      onClick={() => {
                        setActiveMatchId(match.id);
                        setScreen("live");
                      }}
                    >
<div className="history-top">
  <span className="eyebrow">
    {match.status === "completed"
      ? "COMPLETED"
      : "LIVE"}
  </span>

  <span className="history-format">
    {format.id === "normal" ? "NORMAL" : "PLAYOFF"}
  </span>
</div>

<div className="history-match-name">
  {match.name || "Unnamed match"}
</div>

                      <div className="history-teams">
                        <span>{match.teamA.name}</span>
                        <strong>
                          {aSets} — {bSets}
                        </strong>
                        <span>{match.teamB.name}</span>
                      </div>

                      <div className="history-bottom">
                        {match.status === "completed"
                          ? `Winner: ${
                              match.winner === "a"
                                ? match.teamA.name
                                : match.teamB.name
                            }`
                          : "Continue scoring"}
                        <span>→</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </section>
      </main>
    );
  }

  if (screen === "setup" && selectedTournament) {
    return (
      <main className="app-shell">
        <Header />

        <button
          className="back-button"
          onClick={() => setScreen("tournament")}
        >
          ← Back to tournament
        </button>

        <section className="intro-section compact">
          <div className="eyebrow">START MATCH</div>
          <h1>Match setup.</h1>
          <p className="intro-copy">
            Enter the two teams and select the scoring format.
          </p>
        </section>

<section className="setup-section">
  <div className="team-form-card">
    <div className="team-form-heading">
      <div className="eyebrow">MATCH DETAILS</div>
      <h2>Match name</h2>
    </div>

    <div className="form-stack">
      <label className="field-label">
        Match name
        <input
          value={matchName}
          onChange={event => setMatchName(event.target.value)}
          placeholder="Example: Match 1 or Semi Final"
        />
      </label>
    </div>
  </div>

  <TeamForm
    title="Team A"
    team={teamA}
    setTeam={setTeamA}
  />

          <div className="versus-divider">VS</div>

          <TeamForm
            title="Team B"
            team={teamB}
            setTeam={setTeamB}
          />

          <div className="format-box">
            <label className="field-label">
              Scoring format
              <select
                value={formatId}
                onChange={event =>
                  setFormatId(event.target.value as FormatId)
                }
              >
                {FORMATS.map(format => (
                  <option key={format.id} value={format.id}>
                    {format.name}
                  </option>
                ))}
              </select>
            </label>

            <p className="format-description">
              {getFormat(formatId).description}
            </p>

            <div className="scoring-note">
              <strong>Point scoring</strong>
              <span>0 → 15 → 30 → 40 → 60</span>
              <span>Deuce twice, then golden point.</span>
            </div>
          </div>

          {formError && <div className="error-message">{formError}</div>}

          <button className="primary-button large-button" onClick={startMatch}>
            Start live match
          </button>
        </section>
      </main>
    );
  }

  if (screen === "live" && selectedTournament && activeMatch) {
    const format = getFormat(activeMatch.formatId);
    const aSets = getSetWinnerCount(activeMatch.sets, "a");
    const bSets = getSetWinnerCount(activeMatch.sets, "b");

    return (
      <main className="app-shell live-page">
        <div className="live-header">
          <button className="back-button" onClick={backToTournament}>
            ← Tournament
          </button>

          <span className="live-status">
            {activeMatch.status === "completed" ? "COMPLETED" : "● LIVE"}
          </span>
        </div>

<section className="live-heading">
  <div className="eyebrow">{selectedTournament.name}</div>
  <h1>{activeMatch.name || "Live score."}</h1>
  <p className="live-format">
    {format.name}
  </p>
</section>

        {activeMatch.status === "completed" && (
          <div className="winner-banner">
            <div className="eyebrow">MATCH WINNER</div>
            <strong>
              {activeMatch.winner === "a"
                ? activeMatch.teamA.name
                : activeMatch.teamB.name}
            </strong>
          </div>
        )}

        <section className="scoreboard">
          <div className="scoreboard-team">
            <div className="team-side-label">TEAM A</div>
            <h2>{activeMatch.teamA.name}</h2>
            <p>
              {activeMatch.teamA.player1} + {activeMatch.teamA.player2}
            </p>
            <div className="set-total">{aSets}</div>
            <span className="set-caption">SETS WON</span>
          </div>

          <div className="scoreboard-middle">
            <span>VS</span>
          </div>

          <div className="scoreboard-team team-b">
            <div className="team-side-label">TEAM B</div>
            <h2>{activeMatch.teamB.name}</h2>
            <p>
              {activeMatch.teamB.player1} + {activeMatch.teamB.player2}
            </p>
            <div className="set-total">{bSets}</div>
            <span className="set-caption">SETS WON</span>
          </div>
        </section>

        <section className="current-set-card">
          <div className="current-set-header">
            <div>
              <div className="eyebrow">CURRENT SET</div>
              <h2>
                Set {activeMatch.sets.length + 1} of {format.bestOfSets}
              </h2>
            </div>

            {activeMatch.current.deuceCount > 0 && (
              <div className="deuce-badge">
                {activeMatch.current.deuceCount >= 3
                  ? "GOLDEN POINT"
                  : `DEUCE ${activeMatch.current.deuceCount}`}
              </div>
            )}
          </div>

          <div className="point-score">
            <div>
              <strong>
                {formatPointDisplay(activeMatch.current, "a")}
              </strong>
              <span>{activeMatch.teamA.name}</span>
            </div>

            <div className="point-colon">:</div>

            <div>
              <strong>
                {formatPointDisplay(activeMatch.current, "b")}
              </strong>
              <span>{activeMatch.teamB.name}</span>
            </div>
          </div>

          <div className="point-buttons">
            <button
              className="point-button"
              onClick={() => addPoint("a")}
              disabled={activeMatch.status === "completed"}
            >
              <span>+ POINT</span>
              <strong>{activeMatch.teamA.name}</strong>
            </button>

            <button
              className="point-button"
              onClick={() => addPoint("b")}
              disabled={activeMatch.status === "completed"}
            >
              <span>+ POINT</span>
              <strong>{activeMatch.teamB.name}</strong>
            </button>
          </div>

<button
  className="undo-button"
  onClick={undoLastPoint}
  disabled={!activeMatch.history || activeMatch.history.length === 0}
>
  Undo last action
</button>
        </section>

        <section className="set-history-card">
          <div className="eyebrow">SET HISTORY</div>
          <h2>Completed sets</h2>

          {activeMatch.sets.length === 0 ? (
            <p className="muted-text">No completed sets yet.</p>
          ) : (
            <div className="set-history">
              {activeMatch.sets.map((set, index) => (
                <div className="set-history-row" key={index}>
                  <span>SET {index + 1}</span>
                  <strong>{set.a}</strong>
                  <strong>{set.b}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rules-card">
          <div className="eyebrow">SCORING RULES</div>
          <p>
            Each set follows 0, 15, 30, 40 and 60. At 40–40, advantage is
            used. After the second deuce return, the next point is golden
            point.
          </p>
        </section>
      </main>
    );
  }

  return null;
}

function Header() {
  return (
    <header className="site-header">
      <div className="eyebrow">THE BASELINE / PRIVATE TOURNAMENT MANAGER</div>
      <div className="brand-mark">PADEL<br />MANAGER.</div>
      <div className="header-note">
        SIMPLE COURTSIDE<br />SCORING
      </div>
    </header>
  );
}

function TeamForm({
  title,
  team,
  setTeam
}: {
  title: string;
  team: Team;
  setTeam: React.Dispatch<React.SetStateAction<Team>>;
}) {
  return (
    <div className="team-form-card">
      <div className="team-form-heading">
        <div className="eyebrow">{title}</div>
        <h2>Team details</h2>
      </div>

      <div className="form-stack">
        <label className="field-label">
          Team name
          <input
            value={team.name}
            onChange={event =>
              setTeam(current => ({
                ...current,
                name: event.target.value
              }))
            }
            placeholder={`${title} name`}
          />
        </label>

        <label className="field-label">
          Player 1
          <input
            value={team.player1}
            onChange={event =>
              setTeam(current => ({
                ...current,
                player1: event.target.value
              }))
            }
            placeholder="Player name"
          />
        </label>

        <label className="field-label">
          Player 2
          <input
            value={team.player2}
            onChange={event =>
              setTeam(current => ({
                ...current,
                player2: event.target.value
              }))
            }
            placeholder="Player name"
          />
        </label>
      </div>
    </div>
  );
}