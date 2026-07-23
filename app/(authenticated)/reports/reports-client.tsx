"use client";

import { useState, useCallback } from "react";
import Card from "@/modules/core/components/card";
import StatusPill from "@/modules/core/components/status-pill";

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
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <h1 className="page-title">Monthly Attendance Report</h1>

      <Card style={{ marginBottom: "1.25rem" }}>
        <div className="flex-row gap-lg flex-wrap">
          <div>
            <label className="form-label">Month</label>
            <select
              value={month}
              onChange={(e) => { setMonth(Number(e.target.value)); setLoaded(false); }}
              className="form-select"
              style={{ minWidth: 150 }}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Year</label>
            <select
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); setLoaded(false); }}
              className="form-select"
              style={{ minWidth: 110 }}
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
              <label className="form-label">Staff (optional)</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="form-select"
                style={{ minWidth: 180 }}
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

        <div className="flex-row gap-md mt-2">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? "Loading..." : "View Report"}
          </button>

          {loaded && (
            <a href={xlsxUrl} className="btn btn-success">
              Download report
            </a>
          )}
        </div>
      </Card>

      {error && (
        <p className="form-error mb-2">{error}</p>
      )}

      {loaded && filteredSummary.length === 0 && !loading && (
        <Card>
          <p className="text-muted text-center" style={{ padding: "1rem 0", margin: 0 }}>
            No attendance records for this month.
          </p>
        </Card>
      )}

      {loaded && filteredSummary.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table className="table-card" style={{ boxShadow: "none", border: "none", borderRadius: 0 }}>
            <thead>
              <tr>
                <th>Staff</th>
                <th style={{ textAlign: "center" }}>Present</th>
                <th style={{ textAlign: "center" }}>Absent</th>
                <th style={{ textAlign: "center" }}>Leave</th>
                <th style={{ textAlign: "center" }}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummary.map((row) => (
                <tr key={row.userName}>
                  <td style={{ fontWeight: 600 }}>{row.userName}</td>
                  <td style={{ textAlign: "center" }}>
                    {row.presentCount > 0 ? (
                      <StatusPill status="present" label={String(row.presentCount)} />
                    ) : (
                      row.presentCount
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {row.absentCount > 0 ? (
                      <StatusPill status="absent" label={String(row.absentCount)} />
                    ) : (
                      row.absentCount
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {row.leaveCount > 0 ? (
                      <StatusPill status="leave" label={String(row.leaveCount)} />
                    ) : (
                      row.leaveCount
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {row.pendingCount > 0 ? (
                      <StatusPill status="pending" label={String(row.pendingCount)} />
                    ) : (
                      row.pendingCount
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
