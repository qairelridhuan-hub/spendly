type WorkerInfo = {
  name: string;
  email: string;
};

type PayrollInfo = {
  period: string;
  totalHours: number;
  overtimeHours: number;
  totalEarnings: number;
  absenceDeductions: number;
  status?: string;
};

type AttendanceLog = {
  date: string;
  clockIn?: string;
  clockOut?: string;
  hours?: number;
  status?: string;
};

type AdminWorkerRow = {
  workerId: string;
  name: string;
  totalHours: number;
  totalEarnings: number;
  overtimeHours: number;
  absenceDeductions: number;
  status?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

export const getPeriodKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const formatPeriodLabel = (period: string) => {
  if (!period) return "—";
  const [year, month] = period.split("-");
  const monthIndex = Number(month) - 1;
  if (Number.isNaN(monthIndex)) return period;
  return new Date(Number(year), monthIndex, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const formatCurrency = (value: number) => `RM ${value.toFixed(2)}`;

const isInPeriod = (date: string, period: string) => {
  if (!date || !period) return false;
  const [year, month] = period.split("-");
  return date.startsWith(`${year}-${month}`);
};

const sumAttendanceHours = (logs: AttendanceLog[]) =>
  logs.reduce((sum, item) => sum + Number(item.hours ?? 0), 0);

const countAbsences = (logs: AttendanceLog[]) =>
  logs.filter(item => String(item.status) === "absent").length;

export const buildWorkerReportHtml = (params: {
  worker: WorkerInfo;
  period: string;
  payroll?: PayrollInfo | null;
  attendance: AttendanceLog[];
}) => {
  const { worker, period, payroll, attendance } = params;
  const logs = attendance
    .filter(item => isInPeriod(item.date, period))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const totalHours =
    payroll?.totalHours ?? sumAttendanceHours(logs);
  const overtimeHours = payroll?.overtimeHours ?? 0;
  const totalEarnings =
    payroll?.totalEarnings ?? totalHours * 0;
  const absences = payroll?.absenceDeductions ?? countAbsences(logs);

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Spendly Report</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin: 24px 0 8px; }
      .muted { color: #64748b; font-size: 12px; }
      .summary { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin-top: 12px; }
      .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
      .value { font-size: 16px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
      th { color: #64748b; font-weight: 600; }
    </style>
  </head>
  <body>
    <h1>Spendly Monthly Report</h1>
    <div class="muted">${formatPeriodLabel(period)}</div>
    <div class="muted">${worker.name} • ${worker.email}</div>

    <h2>Summary</h2>
    <div class="summary">
      <div class="card">
        <div class="muted">Total Hours</div>
        <div class="value">${totalHours.toFixed(1)}h</div>
      </div>
      <div class="card">
        <div class="muted">Total Earnings</div>
        <div class="value">${formatCurrency(totalEarnings)}</div>
      </div>
      <div class="card">
        <div class="muted">Overtime</div>
        <div class="value">${overtimeHours.toFixed(1)}h</div>
      </div>
      <div class="card">
        <div class="muted">Absences</div>
        <div class="value">${absences}</div>
      </div>
    </div>

    <h2>Attendance</h2>
    ${
      logs.length === 0
        ? `<div class="muted">No attendance records for this period.</div>`
        : `<table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${logs
              .map(
                item => `
                <tr>
                  <td>${item.date || "-"}</td>
                  <td>${item.clockIn || "-"}</td>
                  <td>${item.clockOut || "-"}</td>
                  <td>${Number(item.hours ?? 0).toFixed(1)}</td>
                  <td>${item.status || "pending"}</td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>`
    }
  </body>
</html>
`;
};

export const buildAdminReportHtml = (params: {
  period: string;
  summary: {
    totalHours: number;
    overtimeHours: number;
    absenceDeductions: number;
    totalEarnings: number;
  };
  workers: AdminWorkerRow[];
}) => {
  const { period, summary, workers } = params;
  const safeSummary = {
    totalHours: Number(summary.totalHours ?? 0),
    overtimeHours: Number(summary.overtimeHours ?? 0),
    absenceDeductions: Number(summary.absenceDeductions ?? 0),
    totalEarnings: Number(summary.totalEarnings ?? 0),
  };
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Spendly Admin Report</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin: 24px 0 8px; }
      .muted { color: #64748b; font-size: 12px; }
      .summary { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin-top: 12px; }
      .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
      .value { font-size: 16px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
      th { color: #64748b; font-weight: 600; }
    </style>
  </head>
  <body>
    <h1>Spendly Admin Report</h1>
    <div class="muted">${formatPeriodLabel(period)}</div>

    <h2>Summary</h2>
    <div class="summary">
      <div class="card">
        <div class="muted">Total Hours</div>
        <div class="value">${safeSummary.totalHours.toFixed(1)}h</div>
      </div>
      <div class="card">
        <div class="muted">Total Earnings</div>
        <div class="value">${formatCurrency(safeSummary.totalEarnings)}</div>
      </div>
      <div class="card">
        <div class="muted">Overtime</div>
        <div class="value">${safeSummary.overtimeHours.toFixed(1)}h</div>
      </div>
      <div class="card">
        <div class="muted">Absences</div>
        <div class="value">${safeSummary.absenceDeductions.toFixed(0)}</div>
      </div>
    </div>

    <h2>Worker Breakdown</h2>
    ${
      workers.length === 0
        ? `<div class="muted">No payroll records for this period.</div>`
        : `<table>
          <thead>
            <tr>
              <th>Worker</th>
              <th>Hours</th>
              <th>Overtime</th>
              <th>Earnings</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${workers
              .map(
                row => `
                <tr>
                  <td>${row.name}</td>
                  <td>${row.totalHours.toFixed(1)}</td>
                  <td>${row.overtimeHours.toFixed(1)}</td>
                  <td>${formatCurrency(row.totalEarnings)}</td>
                  <td>${row.status || "pending"}</td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>`
    }
  </body>
</html>
`;
};
