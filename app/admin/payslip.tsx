import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Receipt,
  Search,
  Users,
  Wallet,
  X,
} from "lucide-react-native";
import {
  collection,
  collectionGroup,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { useAdminTheme } from "@/lib/admin/theme";
import { buildPayslipHtml } from "@/lib/reports/report";
import { printReport } from "@/lib/reports/print";
import { AdminErrorBanner } from "@/lib/admin/error-banner";
import { makeSnapshotErrorHandler } from "@/lib/firebase/errors";
import { adminCardShadow } from "@/lib/admin/shadows";

// ─── Types ────────────────────────────────────────────────────────────────────

type Worker = {
  id: string;
  name: string;
  email: string;
  gender: string;
  position: string;
  hourlyRate: number;
};

type PayrollRecord = {
  id: string;
  refPath: string;
  workerId: string;
  period: string;
  totalHours: number;
  overtimeHours: number;
  totalEarnings: number;
  absenceDeductions: number;
  status: string;
};

type PayslipRow = {
  key: string;
  worker: Worker;
  payroll: PayrollRecord;
};

type SortField = "name" | "period" | "totalEarnings" | "status";
type SortDir = "asc" | "desc";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPayslip() {
  const { colors: c } = useAdminTheme();
  const [workers, setWorkers] = useState<Record<string, Worker>>({});
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("period");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [previewRecord, setPreviewRecord] = useState<PayslipRow | null>(null);
  const previewAnim = useRef(new Animated.Value(0)).current;
  const [error, setError] = useState("");

  // ── Firebase ──
  useEffect(() => {
    const onSnapError = makeSnapshotErrorHandler(setError, "admin/payslip");
    const wq = query(collection(db, "users"), where("role", "==", "worker"));
    const unsubW = onSnapshot(wq, snap => {
      const map: Record<string, Worker> = {};
      snap.forEach(d => {
        const v = d.data() as any;
        map[d.id] = {
          id: d.id,
          name: v.fullName || v.displayName || v.email || "Worker",
          email: v.email || "",
          gender: v.gender || "—",
          position: v.position || "—",
          hourlyRate: Number(v.hourlyRate ?? 0),
        };
      });
      setWorkers(map);
    }, onSnapError);
    const unsubP = onSnapshot(collectionGroup(db, "payroll"), snap => {
      setPayrollRecords(
        snap.docs.map(d => {
          const v = d.data() as any;
          return {
            id: d.id,
            refPath: d.ref.path,
            workerId: v.workerId || d.ref.parent?.parent?.id || "",
            period: v.period || d.id || "",
            totalHours: Number(v.totalHours ?? 0),
            overtimeHours: Number(v.overtimeHours ?? 0),
            totalEarnings: Number(v.totalEarnings ?? 0),
            absenceDeductions: Number(v.absenceDeductions ?? 0),
            status: v.status || "pending",
          };
        })
      );
    }, onSnapError);
    return () => { unsubW(); unsubP(); };
  }, []);

  // ── Derived data ──
  const rows: PayslipRow[] = useMemo(
    () =>
      payrollRecords
        .filter(pr => workers[pr.workerId])
        .map(pr => ({ key: `${pr.workerId}-${pr.period}`, worker: workers[pr.workerId], payroll: pr })),
    [payrollRecords, workers]
  );

  const filtered = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x => x.worker.name.toLowerCase().includes(q));
    }
    if (filterStatus !== "all") r = r.filter(x => x.payroll.status === filterStatus);
    return [...r].sort((a, b) => {
      const av = sortField === "name" ? a.worker.name
        : sortField === "period" ? a.payroll.period
        : sortField === "totalEarnings" ? a.payroll.totalEarnings
        : a.payroll.status;
      const bv = sortField === "name" ? b.worker.name
        : sortField === "period" ? b.payroll.period
        : sortField === "totalEarnings" ? b.payroll.totalEarnings
        : b.payroll.status;
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [rows, search, filterStatus, sortField, sortDir]);

  const stats = useMemo(() => ({
    total: rows.length,
    paid: rows.filter(r => r.payroll.status === "paid").length,
    pending: rows.filter(r => r.payroll.status === "pending").length,
    totalAmount: rows
      .filter(r => r.payroll.status === "paid")
      .reduce((s, r) => s + r.payroll.totalEarnings, 0),
  }), [rows]);

  // ── Helpers ──
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const statusColor = (s: string) =>
    s === "paid" ? c.success : s === "verified" ? c.accent : c.warning;

  const statusLabel = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1);

  const openPreview = (row: PayslipRow) => {
    setPreviewRecord(row);
    Animated.spring(previewAnim, {
      toValue: 1, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  };

  const closePreview = () => {
    Animated.timing(previewAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(
      () => setPreviewRecord(null)
    );
  };

  const handleDownload = async (row: PayslipRow) => {
    try {
      const html = buildPayslipHtml({ worker: row.worker, payroll: row.payroll });
      const filename = `payslip-${row.worker.name.replace(/\s+/g, "-")}-${row.payroll.period}.pdf`;
      await printReport(html, filename);
    } catch (err: any) {
      Alert.alert("Error", `Could not generate PDF: ${err?.message ?? String(err)}`);
    }
  };

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <TouchableOpacity
      onPress={() => toggleSort(field)}
      style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
    >
      <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>
        {label}
      </Text>
      {sortField === field ? (
        sortDir === "asc"
          ? <ChevronUp size={11} color={c.accent} />
          : <ChevronDown size={11} color={c.accent} />
      ) : (
        <ArrowUpDown size={10} color={c.textMuted} strokeWidth={2.5} />
      )}
    </TouchableOpacity>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: c.backgroundStart }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <AdminErrorBanner message={error} />

        {/* ── Page header ── */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.3 }}>
            Payslip
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
            Salary payment records
          </Text>
        </View>

        {/* ── Stat cards ── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <StatCard
            icon={<Users size={16} color="#6366f1" />}
            iconBg="#6366f122"
            label="Total Records"
            value={String(stats.total)}
            valueColor={c.text}
            c={c}
          />
          <StatCard
            icon={<Receipt size={16} color={c.accent} />}
            iconBg={c.accent + "22"}
            label="Paid"
            value={String(stats.paid)}
            valueColor={c.success}
            c={c}
          />
          <StatCard
            icon={<ArrowUpDown size={16} color={c.warning} />}
            iconBg={c.warning + "22"}
            label="Pending"
            value={String(stats.pending)}
            valueColor={c.warning}
            c={c}
          />
          <StatCard
            icon={<Wallet size={16} color={c.success} />}
            iconBg={c.success + "22"}
            label="Total Disbursed"
            value={`RM ${stats.totalAmount.toFixed(0)}`}
            valueColor={c.success}
            c={c}
          />
        </View>

        {/* ── Search & Filters ── */}
        <View style={{
          backgroundColor: c.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.border,
          marginBottom: 12,
          overflow: "hidden",
          ...adminCardShadow,
        }}>
          {/* Search */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}>
            <Search size={16} color={c.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search employee name..."
              placeholderTextColor={c.textMuted}
              style={{ flex: 1, color: c.text, fontSize: 14 }}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                style={{ backgroundColor: c.surfaceAlt, borderRadius: 20, padding: 4 }}
              >
                <X size={12} color={c.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Status filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: "row" }}
          >
            <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: "600", alignSelf: "center", marginRight: 4 }}>
              Status:
            </Text>
            {["all", "pending", "verified", "paid"].map(s => {
              const active = filterStatus === s;
              const color = s === "all" ? c.accent
                : s === "paid" ? c.success
                : s === "verified" ? c.accent
                : c.warning;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setFilterStatus(s)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: active ? color + "22" : c.surfaceAlt,
                    borderWidth: 1,
                    borderColor: active ? color + "66" : c.border,
                  }}
                >
                  <Text style={{
                    color: active ? color : c.textMuted,
                    fontSize: 12,
                    fontWeight: active ? "700" : "400",
                  }}>
                    {s === "all" ? "All" : statusLabel(s)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {(filterStatus !== "all" || search) && (
              <TouchableOpacity
                onPress={() => { setFilterStatus("all"); setSearch(""); }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: c.surfaceAlt,
                  borderWidth: 1,
                  borderColor: c.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <X size={11} color={c.textMuted} />
                <Text style={{ color: c.textMuted, fontSize: 12 }}>Clear</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* ── Table ── */}
        <View style={{
          backgroundColor: c.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.border,
          overflow: "hidden",
          ...adminCardShadow,
        }}>
          {/* Table header */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.surfaceAlt,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}>
            <View style={{ flex: 2.5 }}>
              <SortBtn field="name" label="EMPLOYEE" />
            </View>
            <View style={{ flex: 1.4 }}>
              <SortBtn field="period" label="PERIOD" />
            </View>
            <View style={{ flex: 1.5 }}>
              <SortBtn field="totalEarnings" label="TOTAL PAID" />
            </View>
            <View style={{ flex: 1.2 }}>
              <SortBtn field="status" label="STATUS" />
            </View>
            <Text style={{ flex: 1.4, color: c.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textAlign: "right" }}>
              ACTIONS
            </Text>
          </View>

          {/* Rows */}
          {filtered.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: "center", gap: 10 }}>
              <View style={{ backgroundColor: c.surfaceAlt, borderRadius: 40, padding: 16 }}>
                <Receipt size={28} color={c.textMuted} />
              </View>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>No payslip records found.</Text>
              {(search || filterStatus !== "all") && (
                <TouchableOpacity onPress={() => { setSearch(""); setFilterStatus("all"); }}>
                  <Text style={{ color: c.accent, fontSize: 13, fontWeight: "600" }}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filtered.map((row, idx) => (
              <TableRow
                key={row.key}
                row={row}
                idx={idx}
                c={c}
                statusColor={statusColor}
                statusLabel={statusLabel}
                onView={() => openPreview(row)}
                onDownload={() => handleDownload(row)}
              />
            ))
          )}

          {/* Footer count */}
          {filtered.length > 0 && (
            <View style={{
              borderTopWidth: 1,
              borderTopColor: c.border,
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>
                Showing {filtered.length} of {rows.length} record{rows.length !== 1 ? "s" : ""}
              </Text>
              {filtered.length !== rows.length && (
                <Text style={{ color: c.accent, fontSize: 12 }}>
                  {rows.length - filtered.length} filtered out
                </Text>
              )}
            </View>
          )}
        </View>

      </ScrollView>

      {/* ── Preview Modal ── */}
      {previewRecord && (
        <Modal
          transparent
          animationType="none"
          visible={!!previewRecord}
          onRequestClose={closePreview}
        >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", alignItems: "center", padding: 20 }}>
            <Animated.View
              style={{
                width: "100%",
                maxWidth: 460,
                opacity: previewAnim,
                transform: [{
                  scale: previewAnim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }),
                }],
              }}
            >
              <TouchableOpacity activeOpacity={1}>
                <View style={{
                  backgroundColor: c.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: c.border,
                  overflow: "hidden",
                }}>

                  {/* Modal top bar */}
                  <LinearGradient
                    colors={[c.accentStrong, c.brand || c.accentStrong]}
                    style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ gap: 4 }}>
                        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 }}>
                          PAYSLIP PREVIEW
                        </Text>
                        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                          {previewRecord.worker.name}
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                          {previewRecord.worker.position} · {previewRecord.payroll.period}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={closePreview}
                        style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, padding: 7 }}
                      >
                        <X size={15} color="#fff" />
                      </TouchableOpacity>
                    </View>

                    {/* Status pill inside header */}
                    <View style={{ marginTop: 14 }}>
                      <View style={{
                        alignSelf: "flex-start",
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 20,
                        backgroundColor: "rgba(255,255,255,0.18)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.3)",
                      }}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                          {previewRecord.payroll.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>

                  <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 20, gap: 14 }}>

                    {/* Employee section */}
                    <SectionCard title="Employee Details" c={c}>
                      <ModalDetailRow label="Full Name" value={previewRecord.worker.name} c={c} />
                      <Divider c={c} />
                      <ModalDetailRow label="Email" value={previewRecord.worker.email || "—"} c={c} />
                      <Divider c={c} />
                      <ModalDetailRow label="Position" value={previewRecord.worker.position} c={c} />
                      <Divider c={c} />
                      <ModalDetailRow label="Gender" value={previewRecord.worker.gender} c={c} />
                    </SectionCard>

                    {/* Earnings section */}
                    <SectionCard title="Earnings Breakdown" c={c}>
                      <ModalDetailRow
                        label="Regular Hours"
                        value={`${Math.max(0, previewRecord.payroll.totalHours - previewRecord.payroll.overtimeHours).toFixed(1)}h`}
                        c={c}
                      />
                      <Divider c={c} />
                      <ModalDetailRow
                        label="Overtime Hours"
                        value={`${previewRecord.payroll.overtimeHours.toFixed(1)}h`}
                        c={c}
                      />
                      <Divider c={c} />
                      <ModalDetailRow
                        label="Total Hours"
                        value={`${previewRecord.payroll.totalHours.toFixed(1)}h`}
                        c={c}
                      />
                      <Divider c={c} />
                      <ModalDetailRow
                        label="Absences"
                        value={`${previewRecord.payroll.absenceDeductions} day(s)`}
                        c={c}
                        valueColor={previewRecord.payroll.absenceDeductions > 0 ? "#ef4444" : undefined}
                      />
                    </SectionCard>

                    {/* Total salary highlight */}
                    <View style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: c.success + "14",
                      borderWidth: 1,
                      borderColor: c.success + "44",
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                    }}>
                      <View>
                        <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: "600" }}>NET SALARY</Text>
                        <Text style={{ color: c.text, fontSize: 13, fontWeight: "600", marginTop: 2 }}>
                          {previewRecord.payroll.period}
                        </Text>
                      </View>
                      <Text style={{ color: c.success, fontSize: 24, fontWeight: "700" }}>
                        RM {previewRecord.payroll.totalEarnings.toFixed(2)}
                      </Text>
                    </View>

                  </ScrollView>

                  {/* Download action */}
                  <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: c.border }}>
                    <TouchableOpacity
                      onPress={() => {
                        const snap = previewRecord!;
                        closePreview();
                        setTimeout(() => handleDownload(snap), 250);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        backgroundColor: c.accentStrong,
                        borderRadius: 12,
                        paddingVertical: 13,
                      }}
                    >
                      <Download size={17} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                        Download PDF Payslip
                      </Text>
                    </TouchableOpacity>
                  </View>

                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon, iconBg, label, value, valueColor, c,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueColor: string;
  c: any;
}) {
  return (
    <View style={{
      flex: 1,
      minWidth: 130,
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
      gap: 8,
      ...adminCardShadow,
    }}>
      <View style={{
        width: 30, height: 30,
        borderRadius: 8,
        backgroundColor: iconBg,
        alignItems: "center",
        justifyContent: "center",
      }}>
        {icon}
      </View>
      <View>
        <Text style={{ color: c.textMuted, fontSize: 11 }}>{label}</Text>
        <Text style={{ color: valueColor, fontSize: 16, fontWeight: "700", marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

function TableRow({
  row, idx, c, statusColor, statusLabel, onView, onDownload,
}: {
  row: PayslipRow;
  idx: number;
  c: any;
  statusColor: (s: string) => string;
  statusLabel: (s: string) => string;
  onView: () => void;
  onDownload: () => void;
}) {
  const sc = statusColor(row.payroll.status);
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: idx % 2 !== 0 ? c.surfaceAlt + "60" : "transparent",
    }}>
      {/* Employee */}
      <View style={{ flex: 2.5 }}>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
          {row.worker.name}
        </Text>
        <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
          {row.worker.position}
        </Text>
      </View>
      {/* Period */}
      <Text style={{ flex: 1.4, color: c.textMuted, fontSize: 12 }}>{row.payroll.period}</Text>
      {/* Total */}
      <Text style={{ flex: 1.5, color: c.success, fontSize: 13, fontWeight: "700" }}>
        RM {row.payroll.totalEarnings.toFixed(0)}
      </Text>
      {/* Status */}
      <View style={{ flex: 1.2 }}>
        <View style={{
          alignSelf: "flex-start",
          paddingHorizontal: 9,
          paddingVertical: 3,
          borderRadius: 20,
          backgroundColor: sc + "1a",
          borderWidth: 1,
          borderColor: sc + "55",
        }}>
          <Text style={{ color: sc, fontSize: 10, fontWeight: "700" }}>
            {statusLabel(row.payroll.status).toUpperCase()}
          </Text>
        </View>
      </View>
      {/* Actions */}
      <View style={{ flex: 1.4, flexDirection: "row", gap: 6, justifyContent: "flex-end" }}>
        <TouchableOpacity
          onPress={onView}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 9,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: "#000000",
            borderWidth: 1,
            borderColor: "#000000",
          }}
        >
          <Eye size={12} color="#ffffff" />
          <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "600" }}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDownload}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 9,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: "#ffffff",
            borderWidth: 1,
            borderColor: "#000000",
          }}
        >
          <Download size={12} color="#000000" />
          <Text style={{ color: "#000000", fontSize: 11, fontWeight: "600" }}>PDF</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SectionCard({ title, children, c }: { title: string; children: React.ReactNode; c: any }) {
  return (
    <View style={{
      backgroundColor: c.surfaceAlt,
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.border,
    }}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 }}>
          {title.toUpperCase()}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
        {children}
      </View>
    </View>
  );
}

function ModalDetailRow({
  label, value, c, valueColor,
}: {
  label: string; value: string; c: any; valueColor?: string;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: valueColor ?? c.text, fontSize: 13, fontWeight: "600", maxWidth: "55%", textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}

function Divider({ c }: { c: any }) {
  return <View style={{ height: 1, backgroundColor: c.border }} />;
}
