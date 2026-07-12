"use client";

import { useEffect, useState } from "react";

function useFetch(url) {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!url) {
      setData([]);
      return;
    }
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return data;
}

export default function LocationPicker() {
  const [districtId, setDistrictId] = useState("");
  const [countyId, setCountyId] = useState("");

  const districts = useFetch("/api/districts");
  const counties = useFetch(districtId ? `/api/districts/${districtId}/counties` : null);
  const subcounties = useFetch(countyId ? `/api/counties/${countyId}/subcounties` : null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 360 }}>
      <label>
        District
        <select
          value={districtId}
          onChange={(e) => {
            setDistrictId(e.target.value);
            setCountyId("");
          }}
          style={{ display: "block", width: "100%", padding: "0.4rem" }}
        >
          <option value="">Select a district…</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        County / Municipality
        <select
          value={countyId}
          onChange={(e) => setCountyId(e.target.value)}
          disabled={!districtId}
          style={{ display: "block", width: "100%", padding: "0.4rem" }}
        >
          <option value="">{districtId ? "Select a county…" : "Pick a district first"}</option>
          {counties.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Subcounty / Town Council / Division
        <select disabled={!countyId} style={{ display: "block", width: "100%", padding: "0.4rem" }}>
          <option value="">{countyId ? `${subcounties.length} found` : "Pick a county first"}</option>
          {subcounties.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
