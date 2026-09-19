"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Place } from "@/lib/types";
import { LocateFixed, Minus, Plus } from "lucide-react";
export default function Map({
  places,
  selectedId,
  onSelect,
  focusIds,
  focusKey,
}: {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  focusIds: string[];
  focusKey: number;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const selectRef = useRef(onSelect);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        center: [103.817, 1.323],
        zoom: 12.6,
        minZoom: 10,
        maxZoom: 18,
        style: {
          version: 8,
          sources: {
            base: {
              type: "raster",
              tiles: [
                "https://www.onemap.gov.sg/maps/tiles/Grey/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution:
                'Map data © <a href="https://www.sla.gov.sg/">SLA</a> | <a href="https://www.onemap.gov.sg/">OneMap</a>',
            },
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#e9eee8" },
            },
            {
              id: "base",
              type: "raster",
              source: "base",
              paint: { "raster-saturation": -0.65, "raster-opacity": 0.85 },
            },
          ],
        },
        attributionControl: { compact: true },
      });
      map.current = instance;
    } catch {
      // WebGL construction failure is an external-system error, not derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true);
      return;
    }
    instance.on("load", () => {
      setReady(true);
    });
    instance.on("error", () => setFailed(true));
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const colors = {
      school: "#25645b",
      hdb: "#bf7955",
      address: "#626b78",
      childcare: "#ac7296",
      park: "#79a15c",
      hawker: "#cc9c39",
      transit: "#6689b2",
    };
    const markers = places
      .filter((p) => p.coordinates)
      .map((p) => {
        const button = document.createElement("button");
        button.className = `place-pin${p.id === selectedId ? " pin-selected" : ""}`;
        button.style.backgroundColor = colors[p.category];
        button.setAttribute("aria-label", `Map marker: ${p.name}`);
        button.setAttribute("title", p.name);
        button.textContent = {
          school: "S",
          hdb: "H",
          address: "•",
          childcare: "C",
          park: "P",
          hawker: "F",
          transit: "M",
        }[p.category];
        button.addEventListener("click", () => selectRef.current(p.id));
        return new maplibregl.Marker({ element: button })
          .setLngLat(p.coordinates!)
          .addTo(map.current!);
      });
    return () => markers.forEach((m) => m.remove());
  }, [places, ready, selectedId]);
  useEffect(() => {
    if (!ready || !map.current || !focusIds.length) return;
    const coords = places
      .filter((p) => focusIds.includes(p.id) && p.coordinates)
      .map((p) => p.coordinates!);
    if (!coords.length) return;
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
    );
    map.current.fitBounds(bounds, {
      padding: 90,
      maxZoom: 15,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 650,
    });
  }, [focusKey, focusIds, places, ready]);
  return (
    <>
      <div
        ref={container}
        className="map-canvas"
        role="region"
        aria-label="Interactive Singapore school map"
      />
      {failed && (
        <div className="map-notice">
          Basemap unavailable. All locations remain accessible in the results
          list.
        </div>
      )}
      <div className="map-controls">
        <button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}>
          <Plus size={18} />
        </button>
        <button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}>
          <Minus size={18} />
        </button>
        <button
          aria-label="Reset map to Singapore"
          onClick={() =>
            map.current?.flyTo({ center: [103.835, 1.335], zoom: 11.5 })
          }
        >
          <LocateFixed size={18} />
        </button>
      </div>
    </>
  );
}
