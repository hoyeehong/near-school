"use client";
import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/types";
import {
  housingFilterSchema,
  money,
  type Home,
  type HousingFilters,
  type HousingResponse,
} from "@/lib/housing/types";
export function HomesPanel({
  schools,
  nearId,
  onResults,
  onSelect,
  onSave,
  savedIds,
}: {
  schools: Place[];
  nearId: string;
  onResults: (homes: Home[], filters: HousingFilters) => void;
  onSelect: (home: Home) => void;
  onSave: (home: Home) => void;
  savedIds: string[];
}) {
  const [filters, setFilters] = useState<HousingFilters>(() =>
    housingFilterSchema.parse({ nearId }),
  );
  const [result, setResult] = useState<HousingResponse | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(() =>
    housingFilterSchema.parse({ nearId }),
  );
  useEffect(() => {
    const controller = new AbortController();
    // Fetch status synchronises with an external data request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    setError("");
    const query = new URLSearchParams(
      Object.entries(applied).map(([k, v]) => [k, String(v)]),
    );
    fetch("/api/homes?" + query, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data as HousingResponse;
      })
      .then((data) => {
        setResult(data);
        onResults(data.homes, applied);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setResult(null);
          onResults([], applied);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [applied, onResults]);
  return (
    <div className="homes-panel">
      <p className="panel-description">
        Explore recorded home sales, then save up to three places to compare.
        These are not active listings.
      </p>
      <form
        className="home-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ ...filters });
        }}
      >
        <label>
          Development or street
          <input
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            placeholder="e.g. Duchess or Marine Parade"
          />
        </label>
        <div className="filter-pair">
          <label>
            Housing
            <select
              value={filters.kind}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  kind: e.target.value as HousingFilters["kind"],
                  propertyType: "",
                })
              }
            >
              <option value="private">Private homes</option>
              <option value="hdb">HDB flats</option>
              <option value="all">All housing</option>
            </select>
          </label>
          <label>
            Sale type
            <select
              value={filters.saleType}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  saleType: e.target.value as HousingFilters["saleType"],
                })
              }
            >
              <option value="resale">Resale</option>
              <option value="new">New sale</option>
              <option value="subsale">Subsale</option>
              <option value="all">All sale types</option>
            </select>
          </label>
        </div>
        <label>
          Target school
          <select
            value={filters.nearId}
            onChange={(e) => setFilters({ ...filters, nearId: e.target.value })}
          >
            <option value="">Anywhere in Singapore</option>
            {schools
              .filter((s) => s.coordinates)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.quality === "illustrative" ? " · sample point" : ""}
                </option>
              ))}
          </select>
        </label>
        <div className="filter-pair">
          <label>
            Exploration radius
            <select
              value={filters.radiusMetres}
              onChange={(e) =>
                setFilters({ ...filters, radiusMetres: Number(e.target.value) })
              }
            >
              {[1000, 2000, 3000, 5000, 10000].map((n) => (
                <option key={n} value={n}>
                  {n / 1000} km
                </option>
              ))}
            </select>
          </label>
          <label>
            Sale period
            <select
              value={filters.months}
              onChange={(e) =>
                setFilters({ ...filters, months: Number(e.target.value) })
              }
            >
              {[6, 12, 24, 60].map((n) => (
                <option key={n} value={n}>
                  Last {n} months
                </option>
              ))}
            </select>
          </label>
        </div>
        <details>
          <summary>Budget, size and property type</summary>
          <label>
            Maximum recorded price (S$)
            <input
              type="number"
              min="0"
              max="100000000"
              value={filters.maxPrice || ""}
              onChange={(e) =>
                setFilters({ ...filters, maxPrice: Number(e.target.value) })
              }
              placeholder="No maximum"
            />
          </label>
          <label>
            Minimum area (m²)
            <input
              type="number"
              min="0"
              max="10000"
              value={filters.minArea || ""}
              onChange={(e) =>
                setFilters({ ...filters, minArea: Number(e.target.value) })
              }
              placeholder="Any size"
            />
          </label>
          <label>
            Property type
            <select
              value={filters.propertyType}
              onChange={(e) =>
                setFilters({ ...filters, propertyType: e.target.value })
              }
            >
              <option value="">All types (mixed)</option>
              {(filters.kind === "hdb"
                ? ["2 ROOM", "3 ROOM", "4 ROOM", "5 ROOM", "EXECUTIVE"]
                : [
                    "Condominium",
                    "Apartment",
                    "Executive Condominium",
                    "Terrace",
                    "Semi-detached",
                    "Detached",
                    "Strata Terrace",
                    "Strata Semidetached",
                    "Strata Detached",
                  ]
              ).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </details>
        <button className="primary-action" type="submit" disabled={busy}>
          {busy ? "Finding homes…" : "Find homes"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && !busy && (
        <>
          <p className="home-result-count">
            {result.total} matching locations
            {result.total > result.homes.length
              ? ` · showing first ${result.homes.length}`
              : ""}
          </p>
          <small>
            Statistics use only transactions matching your filters. Bulk sales
            are excluded.{" "}
            {applied.nearId
              ? "Unmapped homes cannot appear in a radius search."
              : ""}
          </small>
          {!result.refreshedAt && (
            <p>
              Verified housing data has not been imported yet. No sample prices
              are shown.
            </p>
          )}
          {result.refreshedAt && (
            <p className="source-note">
              Sources: {result.sources.join(" + ")} · refreshed{" "}
              {new Date(result.refreshedAt).toLocaleDateString("en-SG")}
            </p>
          )}
          {result.homes.map((home) => (
            <article className="home-result" key={home.id}>
              <button className="home-select" onClick={() => onSelect(home)}>
                <strong>{home.name}</strong>
                <span>
                  {money(home.housing.medianPrice)} median ·{" "}
                  {home.housing.count} sales
                </span>
                <small>
                  {home.housing.propertyTypes.join(", ")} ·{" "}
                  {home.housing.latestMonth}
                  {home.coordinates ? "" : " · map location pending"}
                </small>
              </button>
              <button
                className="save-home"
                aria-label={`${savedIds.includes(home.id) ? "Remove" : "Save"} ${home.name}`}
                aria-pressed={savedIds.includes(home.id)}
                onClick={() => onSave(home)}
              >
                {savedIds.includes(home.id) ? "Saved ✓" : "Save to compare"}
              </button>
            </article>
          ))}
          {!result.homes.length && result.refreshedAt && (
            <p>
              No matching sales. Try a wider radius, longer period or a
              different budget.
            </p>
          )}
        </>
      )}
    </div>
  );
}
export function HomeFacts({ home }: { home: Home }) {
  const s = home.housing;
  return (
    <div className="home-facts">
      <p className="source-note">{s.filterSummary}</p>
      <dl>
        <div>
          <dt>Median recorded price</dt>
          <dd>{money(s.medianPrice)}</dd>
        </div>
        <div>
          <dt>Middle 50% of prices</dt>
          <dd>
            {money(s.lowerPrice)}–{money(s.upperPrice)}
          </dd>
        </div>
        <div>
          <dt>Median price / sq ft</dt>
          <dd>
            {s.medianPsf === null
              ? "Not comparable across area types"
              : money(s.medianPsf)}
          </dd>
        </div>
        <div>
          <dt>Median area</dt>
          <dd>
            {s.medianArea.toFixed(0)} m² ({s.areaTypes.join(", ")})
          </dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>
            {s.count} sales · {s.firstMonth}–{s.latestMonth}
          </dd>
        </div>
        <div>
          <dt>Property / sale types</dt>
          <dd>
            {s.propertyTypes.join(", ")} · {s.saleTypes.join(", ")}
          </dd>
        </div>
        <div>
          <dt>Tenure</dt>
          <dd>{s.tenures.join("; ")}</dd>
        </div>
      </dl>
      {s.count < 5 && (
        <p className="evidence-note">
          Small sample: fewer than five matching sales.
        </p>
      )}
      {(s.propertyTypes.length > 1 ||
        s.tenures.length > 1 ||
        s.saleTypes.length > 1) && (
        <p className="evidence-note">
          Mixed properties: narrow the filters before comparing prices.
        </p>
      )}
      <p className="source-note">
        Historical transactions, not a valuation or available listings. Location
        identifies the development or block, not an individual unit.
      </p>
    </div>
  );
}
export function HomeTransactions({ id }: { id: string }) {
  const [rows, setRows] = useState<Record<string, string | number>[] | null>(
      null,
    ),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/homes/" + encodeURIComponent(id));
      if (!r.ok) throw new Error();
      setRows((await r.json()).transactions);
    } catch {
      setError("Transaction records unavailable. Please try again.");
    }
  }
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open && !rows) void load();
      }}
    >
      <summary>Latest transactions (all types)</summary>
      {error && <p>{error}</p>}
      {rows ? (
        <div className="transaction-scroll">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Price</th>
                <th>Area m²</th>
                <th>Type / sale</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.month}</td>
                  <td>
                    {money(Number(r.price))}
                    {Number(r.units) > 1 ? ` (${r.units} units)` : ""}
                  </td>
                  <td>
                    {r.area} {r.areaType}
                  </td>
                  <td>
                    {r.propertyType} / {r.saleType}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Loading records…</p>
      )}
    </details>
  );
}
export function CompareHomes({
  homes,
  schools,
  onRemove,
  onExplore,
}: {
  homes: Home[];
  schools: Place[];
  onRemove: (home: Home) => void;
  onExplore: () => void;
}) {
  const [schoolId, setSchoolId] = useState("");
  const [mode, setMode] = useState<"walk" | "pt">("walk");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("07:00");
  const [journeys, setJourneys] = useState<Record<string, string>>({});
  const journeyVersion = useRef(0);
  function clearJourneys() {
    journeyVersion.current++;
    setJourneys({});
  }
  async function route(home: Home) {
    const version = journeyVersion.current;
    setJourneys((v) => ({ ...v, [home.id]: "Finding route…" }));
    try {
      const r = await fetch("/api/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeId: home.id,
          schoolId,
          mode,
          date: mode === "pt" ? date : undefined,
          time,
        }),
      });
      const d = await r.json();
      if (version !== journeyVersion.current) return;
      setJourneys((v) => ({
        ...v,
        [home.id]: r.ok
          ? `${Math.ceil(d.seconds / 60)} min ${d.mode === "walk" ? "walk" : d.hasTransit ? "public transport" : "walk (no transit leg)"} · ${(d.metres / 1000).toFixed(1)} km walking${d.mode === "pt" ? ` · ${d.transfers} transfers · ${d.date} ${d.time} SGT` : ""} · OneMap estimate`
          : d.error,
      }));
    } catch {
      if (version !== journeyVersion.current) return;
      setJourneys((v) => ({
        ...v,
        [home.id]: "Route unavailable. Try again.",
      }));
    }
  }
  return (
    <section className="comparison-view" aria-label="Home comparison">
      <h2>Your shortlist</h2>
      <p>
        Compare up to three places. Saved figures reflect the filters used when
        you saved them; revisit Homes to refresh. Stored only in this browser.
      </p>
      {!homes.length ? (
        <button className="primary-action" onClick={onExplore}>
          Find homes to compare
        </button>
      ) : (
        <>
          <label>
            Compare school journeys
            <select
              value={schoolId}
              onChange={(e) => {
                setSchoolId(e.target.value);
                clearJourneys();
              }}
            >
              <option value="">Select a target school</option>
              {schools
                .filter((s) => s.coordinates)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="journey-controls">
            <label>
              Travel mode
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as "walk" | "pt");
                  clearJourneys();
                }}
              >
                <option value="walk">Walking</option>
                <option value="pt">Public transport</option>
              </select>
            </label>
            {mode === "pt" && (
              <>
                <label>
                  Travel date
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      clearJourneys();
                    }}
                  />
                </label>
                <label>
                  Departure (Singapore)
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => {
                      setTime(e.target.value);
                      clearJourneys();
                    }}
                  />
                </label>
              </>
            )}
          </div>
          <div className="comparison-grid">
            {homes.map((h) => (
              <article key={h.id}>
                <h3>{h.name}</h3>
                <HomeFacts home={h} />
                <p className="source-note">
                  Saved source snapshot: {h.updatedAt.slice(0, 10)}
                </p>
                <button
                  disabled={
                    !schoolId ||
                    (mode === "pt" && !date) ||
                    journeys[h.id] === "Finding route…"
                  }
                  onClick={() => void route(h)}
                >
                  Check journey
                </button>
                {journeys[h.id] && <p role="status">{journeys[h.id]}</p>}
                <p className="source-note">
                  Official school distance remains unverified. Journeys use
                  mapped points, not verified school gates.
                </p>
                <a href={h.sourceUrl} target="_blank" rel="noreferrer">
                  View data source
                </a>
                <button onClick={() => onRemove(h)}>Remove {h.name}</button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
