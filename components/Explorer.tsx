"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  GraduationCap,
  House,
  Info,
  Layers,
  Leaf,
  MapPin,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrainFront,
  Trees,
  Undo2,
  Utensils,
  X,
} from "lucide-react";
import type { Category, ChatResponse, MapContext, Place } from "@/lib/types";
import { metresBetween } from "@/lib/rules";
const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => <div className="map-loading">Opening your neighbourhood…</div>,
});
const layers: { id: Category; label: string; icon: typeof House }[] = [
  { id: "hdb", label: "HDB blocks", icon: House },
  { id: "childcare", label: "Childcare", icon: GraduationCap },
  { id: "park", label: "Parks", icon: Trees },
  { id: "hawker", label: "Hawker centres", icon: Utensils },
  { id: "transit", label: "MRT / LRT", icon: TrainFront },
];
type Message = {
  role: "user" | "assistant";
  text: string;
  citations?: ChatResponse["citations"];
};
type View = {
  categories: Category[];
  resultIds: string[] | null;
  twoTrack: boolean;
  query: string;
  selectedId: string | null;
};
export default function Explorer({
  initialPlaces,
  dataMode,
  aiMode,
}: {
  initialPlaces: Place[];
  dataMode: "demo" | "live" | "degraded";
  aiMode: "demo" | "live";
}) {
  const [places, setPlaces] = useState(initialPlaces);
  const [view, setView] = useState<View>({
    categories: ["school"],
    resultIds: null,
    twoTrack: false,
    query: "",
    selectedId: null,
  });
  const [previous, setPrevious] = useState<View | null>(null);
  const [year, setYear] = useState<2026 | 2027>(2027),
    [tab, setTab] = useState<"explore" | "ask">("explore");
  const [focusIds, setFocusIds] = useState<string[]>([]),
    [focusKey, setFocusKey] = useState(0);
  const [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [searchBusy, setSearchBusy] = useState(false),
    [searchError, setSearchError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]),
    [help, setHelp] = useState(false);
  const [distance, setDistance] = useState<string | null>(null),
    [addressId, setAddressId] = useState<string | null>(null);
  const requestVersion = useRef(0),
    activeController = useRef<AbortController | null>(null);
  const selected = places.find((p) => p.id === view.selectedId);
  const updateView = (next: Partial<View>) => {
    requestVersion.current++;
    activeController.current?.abort();
    setBusy(false);
    setView((v) => ({ ...v, ...next }));
    setDistance(null);
  };
  const visible = useMemo(
    () =>
      places.filter(
        (p) =>
          view.categories.includes(p.category) &&
          (!view.twoTrack || (p.twoTrackFrom && p.twoTrackFrom <= year)) &&
          (view.resultIds === null || view.resultIds.includes(p.id)) &&
          (!view.query ||
            `${p.name} ${p.address}`
              .toLowerCase()
              .includes(view.query.toLowerCase())),
      ),
    [places, view, year],
  );
  const schoolCount = places.filter((p) => p.category === "school").length;
  function select(id: string) {
    updateView({ selectedId: id });
    setFocusIds([id]);
    setFocusKey((k) => k + 1);
  }
  function toggleLayer(id: Category) {
    updateView({
      categories: view.categories.includes(id)
        ? view.categories.filter((c) => c !== id)
        : [...view.categories, id],
      resultIds: null,
      twoTrack: false,
    });
  }
  async function searchAddress() {
    if (view.query.trim().length < 3 || searchBusy) return;
    setSearchBusy(true);
    setSearchError("");
    const version = ++requestVersion.current;
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(view.query)}`,
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Address search unavailable");
      if (version !== requestVersion.current) return;
      const found = body.places as Place[];
      if (!found.length) {
        setSearchError("No addresses found. Try a six-digit postal code.");
        return;
      }
      setPlaces((p) => [
        ...p.filter((x) => !found.some((f) => f.id === x.id)),
        ...found,
      ]);
      setView((v) => ({
        ...v,
        categories: [...new Set([...v.categories, "address" as Category])],
        resultIds: found.map((p) => p.id),
        query: "",
        twoTrack: false,
      }));
      setFocusIds(found.map((p) => p.id));
      setFocusKey((k) => k + 1);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search unavailable");
    } finally {
      setSearchBusy(false);
    }
  }
  async function checkDistance(schoolId: string) {
    if (!addressId) {
      setDistance(
        "Select a residential address or HDB block and choose ‘Use this address’ first.",
      );
      return;
    }
    const version = requestVersion.current;
    try {
      const response = await fetch(
        `/api/distance?schoolId=${encodeURIComponent(schoolId)}&addressId=${encodeURIComponent(addressId)}&year=${year}`,
      );
      const body = await response.json();
      if (version === requestVersion.current)
        setDistance(
          response.ok
            ? body.label
            : "Official lookup unavailable. Verify with OneMap.",
        );
    } catch {
      if (version === requestVersion.current)
        setDistance("Official lookup unavailable. Verify with OneMap.");
    }
  }
  async function ask(text: string) {
    if (!text.trim() || busy) return;
    setTab("ask");
    setQuestion("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text }]);
    const version = ++requestVersion.current,
      controller = new AbortController();
    activeController.current = controller;
    const context: MapContext = {
      year,
      selectedId: view.selectedId,
      addressId,
      visibleIds: visible.map((p) => p.id),
      categories: view.categories,
    };
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error ??
            "The assistant is unavailable. You can still explore the map.",
        );
      if (version !== requestVersion.current) return;
      const result = body as ChatResponse;
      setPrevious(view);
      setView((v) => {
        const next = { ...v, query: "", twoTrack: false };
        for (const a of result.actions) {
          if (a.type === "setLayers") next.categories = a.categories;
          if (a.type === "selectFeatures") next.resultIds = a.ids;
        }
        return next;
      });
      const focus = result.actions.find((a) => a.type === "fitBounds");
      if (focus && "ids" in focus) {
        setFocusIds(focus.ids);
        setFocusKey((k) => k + 1);
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", text: result.answer, citations: result.citations },
      ]);
    } catch (e) {
      if (
        version === requestVersion.current &&
        !(e instanceof Error && e.name === "AbortError")
      )
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text:
              e instanceof Error ? e.message : "The assistant is unavailable.",
          },
        ]);
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Near School home">
          <span className="brand-mark">
            <Compass size={22} />
          </span>
          near<span className="brand-light">school</span>
          <span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <button className="nav-active" onClick={() => setTab("explore")}>
            School explorer
          </button>
          <button onClick={() => setHelp(true)}>
            How it works <ArrowUpRight size={13} />
          </button>
        </nav>
        <div className="header-right">
          <span className="singapore-dot" /> Singapore{" "}
          <span className="header-divider" />
          <span className="edition">A clearer start.</span>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-intro">
            <span className="eyebrow">SMALL DISTANCES. BIG BEGINNINGS.</span>
            <h1>
              Find their school.
              <br />
              <em>Know the neighbourhood.</em>
            </h1>
            <p>
              Explore primary schools, understand the new tracks, and see what’s
              around.
            </p>
            <label className="year-select">
              <span>Registration exercise</span>
              <select
                aria-label="Registration exercise"
                value={year}
                onChange={(e) => {
                  requestVersion.current++;
                  activeController.current?.abort();
                  setBusy(false);
                  setYear(Number(e.target.value) as 2026 | 2027);
                  setDistance(null);
                  setView((v) => ({ ...v, resultIds: null }));
                }}
              >
                <option value={2027}>2027 → P1 in 2028</option>
                <option value={2026}>2026 → P1 in 2027</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
          <div className="tabs" role="tablist" aria-label="Explorer panels">
            <button
              role="tab"
              aria-selected={tab === "explore"}
              className={tab === "explore" ? "active" : ""}
              onClick={() => setTab("explore")}
            >
              <MapPin size={15} /> Explore
            </button>
            <button
              role="tab"
              aria-selected={tab === "ask"}
              className={tab === "ask" ? "active" : ""}
              onClick={() => setTab("ask")}
            >
              <Sparkles size={15} /> Ask the map{" "}
              <span className="new-badge">AI</span>
            </button>
          </div>
          {tab === "explore" ? (
            <div className="explore-panel">
              <form
                className="search-box"
                onSubmit={(e) => {
                  e.preventDefault();
                  void searchAddress();
                }}
              >
                <Search size={17} />
                <input
                  aria-label="Search schools or addresses"
                  value={view.query}
                  placeholder="School, address or postal code"
                  onChange={(e) =>
                    updateView({ query: e.target.value, resultIds: null })
                  }
                />
                {view.query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => updateView({ query: "" })}
                  >
                    <X size={14} />
                  </button>
                )}
              </form>
              {searchError && (
                <p className="inline-error" role="status">
                  {searchError}
                </p>
              )}
              {view.query && (
                <button
                  className="text-link address-search"
                  onClick={() => void searchAddress()}
                >
                  {searchBusy
                    ? "Searching…"
                    : "Search this address with OneMap"}{" "}
                  <ArrowRight size={13} />
                </button>
              )}
              <button
                className={`track-filter ${view.twoTrack ? "chosen" : ""}`}
                onClick={() =>
                  updateView({
                    twoTrack: !view.twoTrack,
                    categories: ["school"],
                    resultIds: null,
                  })
                }
              >
                <span className="filter-icon">
                  <Layers size={17} />
                </span>
                <span>
                  <strong>Discover the two-track schools</strong>
                  <small>New for the 2027 exercise</small>
                </span>
                <span className="filter-check">
                  {view.twoTrack ? (
                    <Check size={14} />
                  ) : (
                    <ChevronRight size={17} />
                  )}
                </span>
              </button>
              <div className="section-label">
                THE NEIGHBOURHOOD <span>Map layers</span>
              </div>
              <div className="layer-grid">
                {layers.map(({ id, label, icon: Icon }) => (
                  <button
                    aria-pressed={view.categories.includes(id)}
                    key={id}
                    className={view.categories.includes(id) ? "enabled" : ""}
                    onClick={() => toggleLayer(id)}
                  >
                    <Icon size={14} />
                    {label}
                    {view.categories.includes(id) && <Check size={12} />}
                  </button>
                ))}
              </div>
              <div className="results-heading">
                <span>
                  {visible.length}{" "}
                  {view.categories.length === 1 &&
                  view.categories[0] === "school"
                    ? "schools"
                    : "places"}
                </span>
                <button
                  onClick={() => {
                    updateView({
                      query: "",
                      resultIds: null,
                      twoTrack: false,
                      categories: ["school"],
                    });
                    setFocusIds(
                      places
                        .filter((p) => p.category === "school")
                        .map((p) => p.id),
                    );
                    setFocusKey((k) => k + 1);
                  }}
                >
                  Reset filters
                </button>
              </div>
              <div className="results-list">
                {visible.length ? (
                  visible.map((p) => (
                    <button
                      key={p.id}
                      className={`result-card ${selected?.id === p.id ? "selected" : ""}`}
                      onClick={() => select(p.id)}
                    >
                      <span className={`result-icon cat-${p.category}`}>
                        {p.category === "school" ? (
                          <GraduationCap size={18} />
                        ) : p.category === "hdb" ? (
                          <House size={18} />
                        ) : (
                          <MapPin size={18} />
                        )}
                      </span>
                      <span className="result-copy">
                        <strong>{p.name}</strong>
                        <small>{p.address}</small>
                        <span className="result-meta">
                          {p.twoTrackFrom && year >= p.twoTrackFrom ? (
                            <span className="track-badge">
                              Two-track school
                            </span>
                          ) : (
                            <span className="category-name">
                              {p.category === "school"
                                ? "Standard distance priority"
                                : p.category}
                            </span>
                          )}
                          {!p.coordinates && <span>Location pending</span>}
                        </span>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    <Search size={24} />
                    <strong>No matching places</strong>
                    <p>Try another name or reset your filters.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="chat-panel">
              <div className="assistant-intro">
                <span className="assistant-orb">
                  <Sparkles size={21} />
                </span>
                <h2>A little local knowledge.</h2>
                <p>Ask a question. Watch the map respond.</p>
                <span className="demo-pill">
                  {aiMode === "live"
                    ? "Vertex AI · source-backed tools"
                    : "Guided demo · no live model connected"}
                </span>
              </div>
              {!messages.length && (
                <div className="suggestions">
                  {[
                    "Show the two-track schools",
                    "Explain the new Phase 2C rules",
                    "Find parks near Nanyang",
                    "Show HDB blocks around Nanyang",
                  ].map((s) => (
                    <button key={s} onClick={() => void ask(s)}>
                      {s}
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              )}
              <div className="messages" aria-live="polite">
                {messages.map((m, i) => (
                  <div className={`message ${m.role}`} key={i}>
                    {m.role === "assistant" && (
                      <span className="message-label">
                        <Sparkles size={12} /> NEAR SCHOOL
                      </span>
                    )}
                    <p>{m.text}</p>
                    {m.citations?.map((c, j) => (
                      <a key={j} href={c.url} target="_blank" rel="noreferrer">
                        <BookOpen size={12} />
                        {c.title}
                        <ArrowUpRight size={12} />
                      </a>
                    ))}
                  </div>
                ))}
                {busy && (
                  <div className="thinking">
                    Finding your way<span>•••</span>
                  </div>
                )}
              </div>
              {previous && (
                <button
                  className="undo"
                  onClick={() => {
                    updateView(previous);
                    setPrevious(null);
                  }}
                >
                  <Undo2 size={13} /> Undo map change
                </button>
              )}
              <form
                className="chat-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(question);
                }}
              >
                <input
                  aria-label="Ask the map"
                  placeholder={
                    selected
                      ? `Ask about ${selected.name.split(" ")[0]}…`
                      : "What would you like to explore?"
                  }
                  value={question}
                  maxLength={1500}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <button
                  disabled={busy || !question.trim()}
                  aria-label="Send question"
                >
                  <Send size={17} />
                </button>
              </form>
              <p className="chat-footnote">
                Official sources. Clear limits. Always verify with MOE.
              </p>
            </div>
          )}
          <div className="sidebar-footer">
            <ShieldCheck size={15} />
            <span>Independent project. Not affiliated with MOE.</span>
            <button
              aria-label="About data sources"
              onClick={() => setHelp(true)}
            >
              <Info size={14} />
            </button>
          </div>
        </aside>
        <main className="map-panel">
          <Map
            places={visible}
            selectedId={view.selectedId}
            onSelect={select}
            focusIds={focusIds}
            focusKey={focusKey}
          />
          <div className="map-topline">
            <span className="map-location">
              <span className="live-dot" /> SINGAPORE <span>/</span> PRIMARY
              SCHOOLS
            </span>
            <button className="map-help" onClick={() => setHelp(true)}>
              <Info size={14} /> About this map
            </button>
          </div>
          <div className="map-year">
            <span>{year}</span>
            <small>REGISTRATION EXERCISE</small>
          </div>
          {!selected && (
            <div className="map-story">
              <span className="story-tag">
                <Leaf size={13} /> MORE WAYS TO BELONG
              </span>
              <h2>
                A new chapter
                <br />
                for Phase 2C.
              </h2>
              <p>
                12 schools. Two distance tracks.
                <br />
                Explore what changes for your family.
              </p>
              <button
                onClick={() => {
                  updateView({
                    twoTrack: true,
                    categories: ["school"],
                    resultIds: null,
                  });
                  setFocusIds(
                    places.filter((p) => p.twoTrackFrom).map((p) => p.id),
                  );
                  setFocusKey((k) => k + 1);
                }}
              >
                Meet the schools <ArrowRight size={15} />
              </button>
            </div>
          )}
          {selected && (
            <section className="detail-card" aria-label="Selected place">
              <button
                className="close-detail"
                aria-label="Close selected place"
                onClick={() => updateView({ selectedId: null })}
              >
                <X size={16} />
              </button>
              <span className="eyebrow">
                {selected.category === "school"
                  ? "YOUR SCHOOL, IN CONTEXT"
                  : "EXPLORE THE NEIGHBOURHOOD"}
              </span>
              <h2>{selected.name}</h2>
              <p className="detail-address">
                <MapPin size={13} />
                {selected.address}
              </p>
              {selected.category === "school" && (
                <>
                  <div className="track-explainer">
                    <span className="track-badge">
                      {selected.twoTrackFrom && year >= selected.twoTrackFrom
                        ? "Two-track school"
                        : "Standard distance priority"}
                    </span>
                    <p>
                      {selected.twoTrackFrom && year >= selected.twoTrackFrom
                        ? "≤2 km and >2 km tracks. No extra distance priority within each track; citizenship priority still applies."
                        : "Citizenship first, then the official 1 km and 2 km distance categories."}
                    </p>
                  </div>
                  <button
                    className="verify-button"
                    onClick={() => void checkDistance(selected.id)}
                  >
                    <ShieldCheck size={14} /> Check official distance
                  </button>
                  <p className="unverified" role="status">
                    {distance ??
                      "Official distance unverified · no inferred boundaries"}
                  </p>
                </>
              )}
              {["hdb", "address"].includes(selected.category) && (
                <button
                  className="verify-button"
                  onClick={() => {
                    requestVersion.current++;
                    setAddressId(selected.id);
                    setDistance(null);
                  }}
                >
                  {addressId === selected.id ? (
                    <Check size={14} />
                  ) : (
                    <House size={14} />
                  )}{" "}
                  {addressId === selected.id
                    ? "Address selected for lookup"
                    : "Use this address"}
                </button>
              )}
              <div className="detail-actions">
                <button
                  onClick={() => void ask(`Find parks near ${selected.name}`)}
                >
                  Explore nearby <ArrowRight size={14} />
                </button>
                <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                  View source <ArrowUpRight size={13} />
                </a>
              </div>
              <small className="source-note">
                {selected.quality === "illustrative"
                  ? "Illustrative location · verify before use"
                  : `Source updated ${selected.updatedAt}`}
              </small>
              {selected.coordinates && (
                <div className="nearby-summary">
                  {
                    places.filter(
                      (p) =>
                        p.category !== "school" &&
                        p.coordinates &&
                        metresBetween(selected.coordinates!, p.coordinates) <=
                          1000,
                    ).length
                  }{" "}
                  listed neighbourhood places within 1 km · point distance
                </div>
              )}
            </section>
          )}
          <div className="map-bottom">
            <div className="legend">
              <span>
                <i className="legend-school" />
                Primary school
              </span>
              <span>
                <i className="legend-hdb" />
                HDB block
              </span>
              <span>
                <i className="legend-amenity" />
                Neighbourhood amenity
              </span>
            </div>
            <div className="data-banner">
              <Info size={15} />
              <span>
                {dataMode === "live"
                  ? "Source-backed catalogue · official distances checked separately"
                  : dataMode === "degraded"
                    ? "Live service unavailable · showing illustrative fallback"
                    : `Portfolio demo · ${schoolCount} sample schools · illustrative locations`}
              </span>
              <button onClick={() => setHelp(true)}>
                Details <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
        </main>
      </div>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="about-modal"
            role="dialog"
            aria-modal="true"
            aria-label="About this explorer"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-detail"
              aria-label="Close about"
              onClick={() => setHelp(false)}
              autoFocus
            >
              <X size={18} />
            </button>
            <Compass size={28} />
            <h2>A clearer view, with clear limits.</h2>
            <p>
              Near School connects school policy with the neighbourhood around
              it. This independent project does not determine eligibility or
              admission chances.
            </p>
            <h3>What you’re seeing</h3>
            <p>
              {dataMode === "live"
                ? "A published catalogue of source-backed places."
                : "A working demonstration with hand-positioned sample schools, HDB blocks and amenities. These are not official boundaries or a complete school directory."}
            </p>
            <h3>Official distance comes first</h3>
            <p>
              Registration categories require authorised, year-specific
              address–school data. We never calculate an official category from
              a circle, a school pin or a walking route.
            </p>
            <a
              href="https://www.moe.gov.sg/primary/p1-registration/changes-to-p1-registration-framework"
              target="_blank"
              rel="noreferrer"
            >
              Read the MOE framework changes <ArrowUpRight size={14} />
            </a>
            <a
              href="https://www.onemap.gov.sg/"
              target="_blank"
              rel="noreferrer"
            >
              Verify an address in OneMap SchoolQuery <ArrowUpRight size={14} />
            </a>
            <button className="modal-done" onClick={() => setHelp(false)}>
              Back to exploring <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
