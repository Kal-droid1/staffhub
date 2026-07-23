# Attendance module

Handles staff daily sign-in tracking.

## Stage 2 (current)
- Staff sign-in via `/attendance` page
- One record per user per day enforced by unique constraint
- Sign-in creates an AttendanceRecord with `PENDING` status
- Already-signed-in users see their existing record instead of the sign-in button

## Stage 3 (planned)
- Manager/Admin approval of attendance records
- Late arrival detection and flags
- Reporting and export
