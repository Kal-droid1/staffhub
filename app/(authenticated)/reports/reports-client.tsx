"use client";

import { useState, useCallback } from "react";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  department: string | null;
}

interface SummaryRow {
  userName: string;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  pendingCount: number;
}

interface Props {
  currentUserId: string;
}

function getCurrentMonthDefault(): { month: number; year: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
  });
  const [year, month] = formatter.format(now).split("-").map(Number);
  return { month, year };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ReportsClient({ currentUserId }: Props) {
  const defaultMonth = getCurrentMonthDefault();
  const [month, setMonth] = useState(defaultMonth.month);
  const [year, setYear] = useState(defaultMonth.year);
  const [staffId, setStaffId] = useState("");
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError("");
    setStaffId("");

    const params = new URLSearchParams();
    params.set("month", String(month));
    params.set("year", String(year));

    const res = await fetch(`/api/reports/monthly?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to load report.");
      setLoading(false);
      return;
    }

    setSummary(data.summary);
    setStaff(data.staff);
    setLoaded(true);
    setLoading(false);
  }, [month, year]);

  const staffMap: Record<string, string> = {};
  for (const s of staff) {
    staffMap[s.id] = s.name;
  }

  const filteredSummary = staffId
    ? summary.filter((s) => s.userName === staffMap[staffId])
    : summary;

  const xlsxUrl = `/api/reports/monthly?month=${month}&year=${year}&format=xlsx${staffId ? `&userId=${staffId}` : ""}`;

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: "0 1rem" }}>
      <h1>Monthly Attendance Report</h1>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "flex-end",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
            Month
          </label>
          <select
            value={month}
            onChange={(e) => { setMonth(Number(e.target.value)); setLoaded(false); }}
            style={{ padding: "0.5rem", minWidth: 140 }}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
            Year
          </label>
          <select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setLoaded(false); }}
            style={{ padding: "0.5rem", minWidth: 100 }}
          >
            {Array.from({ length: 6 }, (_, i) => year - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {loaded && staff.length > 0 && (
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
              Staff (optional)
            </label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              style={{ padding: "0.5rem", minWidth: 180 }}
            >
              <option value="">All staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <button
          onClick={fetchReport}
          disabled={loading}
          style={{
            padding: "0.5rem 1.5rem",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          {loading ? "Loading..." : "View Report"}
        </button>

        {loaded && (
          <a
            href={xlsxUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.5rem 1.5rem",
              backgroundColor: "#16a34a",
              color: "white",
              textDecoration: "none",
              borderRadius: "0.375rem",
              fontSize: "1rem",
            }}
          >
            Download report
          </a>
        )}
      </div>

      {error && (
        <p style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</p>
      )}

      {loaded && filteredSummary.length === 0 && !loading && (
        <p>No attendance records for this month.</p>
      )}

      {loaded && filteredSummary.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "1rem",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "2px solid #e5e7eb",
                textAlign: "left",
                backgroundColor: "#f9fafb",
              }}
            >
              <th style={{ padding: "0.75rem 0.5rem" }}>Staff</th>
              <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                Present
              </th>
              <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                Absent
              </th>
              <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                Leave
              </th>
              <th style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                Pending
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSummary.map((row) => (
              <tr
                key={row.userName}
                style={{ borderBottom: "1px solid #e5e7eb" }}
              >
                <td style={{ padding: "0.5rem" }}>
                  <strong>{row.userName}</strong>
                </td>
                <td style={{ padding: "0.5rem", textAlign: "center" }}>
                  {row.presentCount}
                </td>
                <td
                  style={{
                    padding: "0.5rem",
                    textAlign: "center",
                    color: row.absentCount > 0 ? "#dc2626" : undefined,
                    fontWeight: row.absentCount > 0 ? 600 : undefined,
                  }}
                >
                  {row.absentCount}
                </td>
                <td style={{ padding: "0.5rem", textAlign: "center" }}>
                  {row.leaveCount}
                </td>
                <td
                  style={{
                    padding: "0.5rem",
                    textAlign: "center",
                    color: row.pendingCount > 0 ? "#d97706" : undefined,
                  }}
                >
                  {row.pendingCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
