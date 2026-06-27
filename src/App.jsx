import React, { useState, useEffect } from "react";
import SearchBar from "./components/SearchBar";
import Settings from "./components/Settings";
import ResultRow from "./components/ResultRow";
import SessionCard from "./components/SessionCard";
import PreviewPane from "./components/PreviewPane";
import "./styles/main.css";
import "./styles/components.css";

function App() {
  // What the user has typed in the search bar
  const [query, setQuery] = useState("");

  // The list of matching files returned by the searcher
  const [results, setResults] = useState([]);

  // All sessions built by the sessioniser
  const [sessions, setSessions] = useState([]);

  const [showSettings, setShowSettings] = useState(false);

  // Which tab the user is on — 'all', 'files', or 'sessions'
  const [activeTab, setActiveTab] = useState("all");

  // The file the user has clicked on (for the preview pane)
  const [selectedFile, setSelectedFile] = useState(null);

  // useEffect runs once when the app first loads
  // We use it to load sessions immediately on startup
  // The empty array [] at the end means "only run this once, not on every re-render"
  useEffect(() => {
    async function loadSessions() {
      const s = await window.panAPI.getSessions();
      setSessions(s);
    }
    loadSessions();
  }, []);

  // This runs every time the query changes
  // If the query is empty, clear the results
  // Otherwise call the searcher and update results
  useEffect(() => {
    async function runSearch() {
      if (query.trim() === "") {
        setResults([]);
        return;
      }
      const r = await window.panAPI.search(query);
      setResults(r);
    }
    runSearch();
  }, [query]); // [query] means "re-run this effect whenever query changes"

  // Listen for the Escape key globally within the app
  // When Escape is pressed, clear the search query and hide the window
  // useEffect with [] runs once on mount and sets up the listener permanently
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        // Clear the search so it's fresh next time the user opens the app
        setQuery("");

        // Ask main.js to hide the window via IPC
        window.panAPI.hideWindow();
      }
    }

    // addEventListener attaches our function to the document —
    // meaning it fires for any keydown event anywhere in the app
    document.addEventListener("keydown", handleKeyDown);

    // The return function is called when the component unmounts (cleans up).
    // Without this cleanup, the listener would stack up and fire multiple
    // times — always clean up event listeners in useEffect
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Decide what to show in the main area depending on the active tab
  // If searching (query not empty), always show results
  // If not searching, show sessions when on the sessions tab
  const showSessions = activeTab === "sessions" && query.trim() === "";
  const showResults = query.trim() !== "" || activeTab === "files";

  return (
    <div className="app">
      <div className="top-bar">
        <SearchBar query={query} onChange={setQuery} />
        <button
          className="settings-btn"
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          ⚙
        </button>
      </div>

      <div className="tabs">
        {["all", "files", "sessions"].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      </div>

      <div className="main-area">
        {/* Empty state — nothing typed, not on sessions tab */}
        {!showSessions && results.length === 0 && query.trim() === "" && (
          <div className="empty-state">
            <p className="empty-title">Your workspace has memory now</p>
            <p className="empty-hint">
              Try: "pdf from last week" or "images from yesterday"
            </p>
          </div>
        )}

        {/* Search results */}
        {showResults && results.length > 0 && (
          <div className="results-list">
            <p className="section-label">Best matches</p>
            {results.map((file, i) => (
              <ResultRow
                key={i}
                file={file}
                selected={selectedFile?.path === file.path}
                onClick={() => setSelectedFile(file)}
              />
            ))}
          </div>
        )}

        {/* No results found */}
        {showResults && results.length === 0 && query.trim() !== "" && (
          <div className="empty-state">
            <p className="empty-hint">No files found for "{query}"</p>
          </div>
        )}

        {/* Sessions view */}
        {showSessions && (
          <div className="sessions-list">
            <p className="section-label">Your sessions</p>
            {sessions.length === 0 && (
              <p className="empty-hint">No sessions found yet.</p>
            )}
            {sessions.map((session, i) => (
              <SessionCard key={i} session={session} />
            ))}
          </div>
        )}
      </div>

      {/* Preview pane only shows when a file is selected */}
      {selectedFile && <PreviewPane file={selectedFile} />}
    </div>
  );
}

export default App;
