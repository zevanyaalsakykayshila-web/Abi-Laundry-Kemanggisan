import React, { useState, useEffect, useMemo, useCallback } from "react";
import { storage } from "./storage";
import {
  Plus,
  Trash2,
  Printer,
  Search,
  Settings as SettingsIcon,
  TrendingUp,
  X,
  Phone,
  Calendar,
  Receipt,
  Shirt,
  Save,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/* ---------------------------------------------------------
   Bersih Laundry — App pencatatan transaksi & cetak faktur
--------------------------------------------------------- */

const STORAGE_SETTINGS = "bersih_laundry_settings_v1";
const STORAGE_TRANSACTIONS = "bersih_laundry_transactions_v1";

const SERVICE_TYPES = ["Cuci + Setrika", "Cuci Saja", "Setrika Saja", "Cuci Express"];
const STATUS_FLOW = ["Diproses", "Siap Diambil", "Selesai"];

const defaultSettings = {
  businessName: "Abi Laundry Kemanggisan",
  ownerNote: "Laundry Kiloan & Satuan",
  address: "Jl. Anggrek Rosliana No.9, RT.9/RW.5, Kemanggisan, Palmerah, Jakarta Barat",
  phone: "0896-3402-3067",
  hours: "Setiap hari 09.30 – 20.30",
  pricePerKg: 7000,
  itemPrices: [
    { id: "it1", name: "Selimut", price: 20000 },
    { id: "it2", name: "Bed Cover", price: 25000 },
    { id: "it3", name: "Jaket Tebal", price: 15000 },
    { id: "it4", name: "Sprei", price: 12000 },
    { id: "it5", name: "Gorden", price: 18000 },
  ],
  footerNote: "Terima kasih sudah mempercayakan cucian Anda ke kami :)",
};

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatRupiah(n) {
  const num = Number(n) || 0;
  return "Rp " + num.toLocaleString("id-ID");
}

function formatDateShort(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function makeInvoiceNo(count) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `INV-${ymd}-${String(count + 1).padStart(3, "0")}`;
}

function emptyItemRow(settings) {
  return {
    rowId: uid("row"),
    calcType: "kg",
    name: "Cucian Kiloan",
    weight: "",
    qty: 1,
    price: settings.pricePerKg,
  };
}

function rowSubtotal(row) {
  if (row.calcType === "kg") {
    return (Number(row.weight) || 0) * (Number(row.price) || 0);
  }
  return (Number(row.qty) || 0) * (Number(row.price) || 0);
}

export default function LaundryApp() {
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("baru");
  const [saveFlash, setSaveFlash] = useState("");
  const [printingTxn, setPrintingTxn] = useState(null);

  // ---------- load from persistent storage ----------
  useEffect(() => {
    (async () => {
      try {
        let s = defaultSettings;
        let t = [];
        try {
          const r = await storage.get(STORAGE_SETTINGS);
          if (r && r.value) s = { ...defaultSettings, ...JSON.parse(r.value) };
        } catch (e) {
          /* no settings yet */
        }
        try {
          const r2 = await storage.get(STORAGE_TRANSACTIONS);
          if (r2 && r2.value) t = JSON.parse(r2.value);
        } catch (e) {
          /* no transactions yet */
        }
        setSettings(s);
        setTransactions(t);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ---------- persist on change ----------
  useEffect(() => {
    if (!loaded) return;
    storage.set(STORAGE_SETTINGS, JSON.stringify(settings)).catch(() => {});
  }, [settings, loaded]);

  useEffect(() => {
    if (!loaded) return;
    storage.set(STORAGE_TRANSACTIONS, JSON.stringify(transactions)).catch(() => {});
  }, [transactions, loaded]);

  const flash = useCallback((msg) => {
    setSaveFlash(msg);
    setTimeout(() => setSaveFlash(""), 1800);
  }, []);

  const addTransaction = (txn) => {
    setTransactions((prev) => [txn, ...prev]);
    flash("Transaksi tersimpan");
  };

  const updateTransactionStatus = (id, status) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const deleteTransaction = (id) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: "#5b6b68" }}>
        Memuat data...
      </div>
    );
  }

  return (
    <div id="app-root">
      <GlobalStyle />
      <div id="app-content">
        <Header settings={settings} saveFlash={saveFlash} />
        <NavTabs active={activeTab} setActive={setActiveTab} />
        <main className="main-wrap">
          {activeTab === "baru" && (
            <NewTransactionTab
              settings={settings}
              existingCount={transactions.length}
              onSave={(txn) => {
                addTransaction(txn);
                setPrintingTxn(txn);
              }}
            />
          )}
          {activeTab === "riwayat" && (
            <HistoryTab
              transactions={transactions}
              onPrint={setPrintingTxn}
              onDelete={deleteTransaction}
              onStatusChange={updateTransactionStatus}
            />
          )}
          {activeTab === "rekap" && <RekapTab transactions={transactions} />}
          {activeTab === "pengaturan" && (
            <SettingsTab settings={settings} setSettings={setSettings} flash={flash} />
          )}
        </main>
      </div>

      {printingTxn && (
        <PrintPreviewModal
          txn={printingTxn}
          settings={settings}
          onClose={() => setPrintingTxn(null)}
        />
      )}

      {printingTxn && <InvoicePrintArea txn={printingTxn} settings={settings} />}
    </div>
  );
}

/* ================= HEADER & NAV ================= */

function Header({ settings, saveFlash }) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="brand">
          <div className="brand-icon">
            <Shirt size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1>{settings.businessName}</h1>
            <p>{settings.ownerNote}{settings.hours ? ` • ${settings.hours}` : ""}</p>
          </div>
        </div>
        <div className={`save-flash ${saveFlash ? "show" : ""}`}>
          <CheckCircle2 size={15} />
          <span>{saveFlash}</span>
        </div>
      </div>
    </header>
  );
}

function NavTabs({ active, setActive }) {
  const tabs = [
    { id: "baru", label: "Transaksi Baru", icon: Plus },
    { id: "riwayat", label: "Riwayat", icon: ClipboardList },
    { id: "rekap", label: "Rekap Penjualan", icon: TrendingUp },
    { id: "pengaturan", label: "Pengaturan", icon: SettingsIcon },
  ];
  return (
    <nav className="tab-nav">
      <div className="tab-nav-inner">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`tab-btn ${active === t.id ? "active" : ""}`}
              onClick={() => setActive(t.id)}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ================= TAB: TRANSAKSI BARU ================= */

function NewTransactionTab({ settings, existingCount, onSave }) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [dateIn, setDateIn] = useState(todayISO());
  const [dateEst, setDateEst] = useState("");
  const [items, setItems] = useState([emptyItemRow(settings)]);
  const [additionalFee, setAdditionalFee] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const total = useMemo(() => {
    const itemsTotal = items.reduce((sum, r) => sum + rowSubtotal(r), 0);
    return itemsTotal + (Number(additionalFee) || 0);
  }, [items, additionalFee]);

  const updateRow = (rowId, patch) => {
    setItems((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };

  const addRow = () => setItems((prev) => [...prev, emptyItemRow(settings)]);
  const removeRow = (rowId) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));

  const handleItemNameSelect = (rowId, itemId) => {
    const found = settings.itemPrices.find((i) => i.id === itemId);
    if (found) {
      updateRow(rowId, { name: found.name, price: found.price, itemId });
    }
  };

  const resetForm = () => {
    setCustomerName("");
    setPhone("");
    setServiceType(SERVICE_TYPES[0]);
    setDateIn(todayISO());
    setDateEst("");
    setItems([emptyItemRow(settings)]);
    setAdditionalFee("");
    setNotes("");
  };

  const handleSubmit = () => {
    if (!customerName.trim()) {
      setError("Nama pelanggan wajib diisi.");
      return;
    }
    if (total <= 0) {
      setError("Isi minimal satu item dengan berat/jumlah yang valid.");
      return;
    }
    setError("");
    const txn = {
      id: uid("txn"),
      invoiceNo: makeInvoiceNo(existingCount),
      customerName: customerName.trim(),
      phone: phone.trim(),
      serviceType,
      dateIn,
      dateEst,
      items: items.map((r) => ({ ...r, subtotal: rowSubtotal(r) })),
      additionalFee: Number(additionalFee) || 0,
      notes: notes.trim(),
      total,
      status: "Diproses",
      createdAt: new Date().toISOString(),
    };
    onSave(txn);
    resetForm();
  };

  return (
    <div className="card form-card">
      <h2 className="card-title">Catat Transaksi Baru</h2>

      <div className="grid-2">
        <Field label="Nama Pelanggan *">
          <input
            className="input"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Contoh: Bu Sari"
          />
        </Field>
        <Field label="No. HP">
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xx-xxxx-xxxx"
          />
        </Field>
      </div>

      <div className="grid-3">
        <Field label="Jenis Layanan">
          <select className="input" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tanggal Masuk">
          <input className="input" type="date" value={dateIn} onChange={(e) => setDateIn(e.target.value)} />
        </Field>
        <Field label="Estimasi Selesai/Ambil">
          <input className="input" type="date" value={dateEst} onChange={(e) => setDateEst(e.target.value)} />
        </Field>
      </div>

      <div className="items-section">
        <div className="items-header">
          <span>Item Cucian</span>
          <button className="btn-ghost" onClick={addRow}>
            <Plus size={15} /> Tambah Item
          </button>
        </div>

        {items.map((row) => (
          <ItemRow
            key={row.rowId}
            row={row}
            settings={settings}
            onChange={(patch) => updateRow(row.rowId, patch)}
            onSelectItem={(itemId) => handleItemNameSelect(row.rowId, itemId)}
            onRemove={() => removeRow(row.rowId)}
          />
        ))}
      </div>

      <div className="grid-2">
        <Field label="Biaya Tambahan (opsional, mis. antar-jemput)">
          <input
            className="input"
            type="number"
            value={additionalFee}
            onChange={(e) => setAdditionalFee(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Catatan">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" />
        </Field>
      </div>

      <div className="total-bar">
        <span>Total Tagihan</span>
        <strong>{formatRupiah(total)}</strong>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <button className="btn-primary btn-full" onClick={handleSubmit}>
        <Save size={16} /> Simpan &amp; Buat Faktur
      </button>
    </div>
  );
}

function ItemRow({ row, settings, onChange, onSelectItem, onRemove }) {
  return (
    <div className="item-row">
      <div className="item-row-type">
        <label className="pill-toggle">
          <button
            className={row.calcType === "kg" ? "pill active" : "pill"}
            onClick={() => onChange({ calcType: "kg", name: "Cucian Kiloan", price: settings.pricePerKg })}
            type="button"
          >
            Kiloan
          </button>
          <button
            className={row.calcType === "pcs" ? "pill active" : "pill"}
            onClick={() =>
              onChange({
                calcType: "pcs",
                name: settings.itemPrices[0]?.name || "Item",
                price: settings.itemPrices[0]?.price || 0,
                itemId: settings.itemPrices[0]?.id,
              })
            }
            type="button"
          >
            Satuan
          </button>
        </label>
      </div>

      {row.calcType === "kg" ? (
        <>
          <div className="item-row-field">
            <span className="field-label-sm">Berat (kg)</span>
            <input
              className="input"
              type="number"
              step="0.1"
              min="0"
              value={row.weight}
              onChange={(e) => onChange({ weight: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="item-row-field">
            <span className="field-label-sm">Harga/kg</span>
            <input
              className="input"
              type="number"
              value={row.price}
              onChange={(e) => onChange({ price: e.target.value })}
            />
          </div>
        </>
      ) : (
        <>
          <div className="item-row-field grow">
            <span className="field-label-sm">Nama Item</span>
            <select
              className="input"
              value={row.itemId || ""}
              onChange={(e) => onSelectItem(e.target.value)}
            >
              {settings.itemPrices.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
          </div>
          <div className="item-row-field">
            <span className="field-label-sm">Qty</span>
            <input
              className="input"
              type="number"
              min="1"
              value={row.qty}
              onChange={(e) => onChange({ qty: e.target.value })}
            />
          </div>
          <div className="item-row-field">
            <span className="field-label-sm">Harga</span>
            <input
              className="input"
              type="number"
              value={row.price}
              onChange={(e) => onChange({ price: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="item-row-subtotal">{formatRupiah(rowSubtotal(row))}</div>
      <button className="icon-btn danger" onClick={onRemove} type="button" aria-label="Hapus item">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

/* ================= TAB: RIWAYAT ================= */

function HistoryTab({ transactions, onPrint, onDelete, onStatusChange }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchQuery =
        !query ||
        t.customerName.toLowerCase().includes(query.toLowerCase()) ||
        t.invoiceNo.toLowerCase().includes(query.toLowerCase());
      const matchStatus = statusFilter === "Semua" || t.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [transactions, query, statusFilter]);

  return (
    <div className="card">
      <div className="history-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            placeholder="Cari nama pelanggan atau no. faktur..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="input status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option>Semua</option>
          {STATUS_FLOW.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="Belum ada transaksi yang cocok." />
      ) : (
        <div className="table-wrap">
          <table className="txn-table">
            <thead>
              <tr>
                <th>Faktur</th>
                <th>Pelanggan</th>
                <th>Layanan</th>
                <th>Tanggal</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.invoiceNo}</td>
                  <td>
                    <div className="cell-strong">{t.customerName}</div>
                    {t.phone && (
                      <div className="cell-sub">
                        <Phone size={11} /> {t.phone}
                      </div>
                    )}
                  </td>
                  <td>{t.serviceType}</td>
                  <td>{formatDateShort(t.dateIn)}</td>
                  <td className="mono cell-strong">{formatRupiah(t.total)}</td>
                  <td>
                    <select
                      className={`status-pill status-${t.status.replace(/\s/g, "")}`}
                      value={t.status}
                      onChange={(e) => onStatusChange(t.id, e.target.value)}
                    >
                      {STATUS_FLOW.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => onPrint(t)} aria-label="Cetak">
                        <Printer size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => {
                          if (confirm(`Hapus transaksi ${t.invoiceNo}?`)) onDelete(t.id);
                        }}
                        aria-label="Hapus"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <Receipt size={30} strokeWidth={1.5} />
      <p>{text}</p>
    </div>
  );
}

/* ================= TAB: REKAP ================= */

function RekapTab({ transactions }) {
  const [period, setPeriod] = useState("bulan");

  const filtered = useMemo(() => {
    const now = new Date();
    return transactions.filter((t) => {
      const d = new Date(t.dateIn);
      if (period === "hari") {
        return d.toDateString() === now.toDateString();
      }
      if (period === "minggu") {
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
      }
      if (period === "bulan") {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [transactions, period]);

  const totalOmzet = filtered.reduce((s, t) => s + t.total, 0);
  const jumlahTransaksi = filtered.length;
  const rataRata = jumlahTransaksi ? totalOmzet / jumlahTransaksi : 0;

  const chartData = useMemo(() => {
    const map = {};
    filtered.forEach((t) => {
      const key = formatDateShort(t.dateIn);
      map[key] = (map[key] || 0) + t.total;
    });
    return Object.entries(map)
      .map(([date, total]) => ({ date, total }))
      .slice(-14);
  }, [filtered]);

  const byService = useMemo(() => {
    const map = {};
    filtered.forEach((t) => {
      if (!map[t.serviceType]) map[t.serviceType] = { count: 0, total: 0 };
      map[t.serviceType].count += 1;
      map[t.serviceType].total += t.total;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filtered]);

  return (
    <div>
      <div className="period-tabs">
        {[
          { id: "hari", label: "Hari Ini" },
          { id: "minggu", label: "7 Hari Terakhir" },
          { id: "bulan", label: "Bulan Ini" },
          { id: "semua", label: "Semua" },
        ].map((p) => (
          <button
            key={p.id}
            className={`period-btn ${period === p.id ? "active" : ""}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total Omzet</span>
          <span className="stat-value">{formatRupiah(totalOmzet)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Jumlah Transaksi</span>
          <span className="stat-value">{jumlahTransaksi}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Rata-rata / Transaksi</span>
          <span className="stat-value">{formatRupiah(rataRata)}</span>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="card chart-card">
          <h3 className="card-subtitle">Omzet per Hari</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4DFD3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B7570" }} axisLine={{ stroke: "#E4DFD3" }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#6B7570" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Math.round(v / 1000)}rb`}
              />
              <Tooltip
                formatter={(v) => formatRupiah(v)}
                contentStyle={{ borderRadius: 10, border: "1px solid #E4DFD3", fontFamily: "Inter, sans-serif", fontSize: 12 }}
              />
              <Bar dataKey="total" fill="#245C57" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {byService.length > 0 && (
        <div className="card">
          <h3 className="card-subtitle">Rincian per Jenis Layanan</h3>
          <div className="service-breakdown">
            {byService.map(([name, data]) => (
              <div className="service-row" key={name}>
                <span className="service-name">{name}</span>
                <span className="service-count">{data.count}x</span>
                <span className="service-total">{formatRupiah(data.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {jumlahTransaksi === 0 && <EmptyState text="Belum ada transaksi pada periode ini." />}
    </div>
  );
}

/* ================= TAB: PENGATURAN ================= */

function SettingsTab({ settings, setSettings, flash }) {
  const [local, setLocal] = useState(settings);

  useEffect(() => setLocal(settings), [settings]);

  const commit = (patch) => {
    const next = { ...local, ...patch };
    setLocal(next);
    setSettings(next);
  };

  const updateItemPrice = (id, patch) => {
    const next = local.itemPrices.map((it) => (it.id === id ? { ...it, ...patch } : it));
    commit({ itemPrices: next });
  };

  const addItemPrice = () => {
    commit({ itemPrices: [...local.itemPrices, { id: uid("it"), name: "Item Baru", price: 10000 }] });
  };

  const removeItemPrice = (id) => {
    commit({ itemPrices: local.itemPrices.filter((it) => it.id !== id) });
  };

  return (
    <div className="card">
      <h2 className="card-title">Pengaturan Usaha</h2>
      <p className="hint-text">Perubahan tersimpan otomatis.</p>

      <div className="grid-2">
        <Field label="Nama Usaha">
          <input className="input" value={local.businessName} onChange={(e) => commit({ businessName: e.target.value })} />
        </Field>
        <Field label="Tagline / Keterangan">
          <input className="input" value={local.ownerNote} onChange={(e) => commit({ ownerNote: e.target.value })} />
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Alamat">
          <input className="input" value={local.address} onChange={(e) => commit({ address: e.target.value })} />
        </Field>
        <Field label="No. HP / WhatsApp">
          <input className="input" value={local.phone} onChange={(e) => commit({ phone: e.target.value })} />
        </Field>
      </div>
      <Field label="Jam Operasional">
        <input className="input" value={local.hours || ""} onChange={(e) => commit({ hours: e.target.value })} placeholder="Contoh: Setiap hari 09.30 – 20.30" />
      </Field>

      <Field label="Harga per Kg (default)">
        <input
          className="input"
          type="number"
          value={local.pricePerKg}
          onChange={(e) => commit({ pricePerKg: Number(e.target.value) || 0 })}
        />
      </Field>

      <div className="items-section">
        <div className="items-header">
          <span>Daftar Harga Item Satuan</span>
          <button className="btn-ghost" onClick={addItemPrice} type="button">
            <Plus size={15} /> Tambah Item
          </button>
        </div>
        {local.itemPrices.map((it) => (
          <div className="price-row" key={it.id}>
            <input className="input" value={it.name} onChange={(e) => updateItemPrice(it.id, { name: e.target.value })} />
            <input
              className="input"
              type="number"
              value={it.price}
              onChange={(e) => updateItemPrice(it.id, { price: Number(e.target.value) || 0 })}
            />
            <button className="icon-btn danger" onClick={() => removeItemPrice(it.id)} type="button">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <Field label="Catatan Kaki Faktur">
        <input className="input" value={local.footerNote} onChange={(e) => commit({ footerNote: e.target.value })} />
      </Field>
    </div>
  );
}

/* ================= PRINT PREVIEW MODAL ================= */

function PrintPreviewModal({ txn, settings, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Faktur Tersimpan</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <ReceiptPreview txn={txn} settings={settings} />
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Tutup
          </button>
          <button className="btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Cetak Faktur
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptPreview({ txn, settings }) {
  return (
    <div className="receipt">
      <div className="receipt-notch-row">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="notch" />
        ))}
      </div>
      <div className="receipt-body">
        <div className="receipt-brand">
          <Shirt size={20} />
          <div>
            <div className="receipt-brand-name">{settings.businessName}</div>
            <div className="receipt-brand-sub">{settings.address}</div>
            <div className="receipt-brand-sub">{settings.phone}{settings.hours ? ` • ${settings.hours}` : ""}</div>
          </div>
        </div>

        <div className="receipt-divider" />

        <div className="receipt-meta">
          <div>
            <span>No. Faktur</span>
            <strong className="mono">{txn.invoiceNo}</strong>
          </div>
          <div>
            <span>Tanggal</span>
            <strong>{formatDateShort(txn.dateIn)}</strong>
          </div>
          <div>
            <span>Pelanggan</span>
            <strong>{txn.customerName}</strong>
          </div>
          {txn.phone && (
            <div>
              <span>No. HP</span>
              <strong>{txn.phone}</strong>
            </div>
          )}
          <div>
            <span>Layanan</span>
            <strong>{txn.serviceType}</strong>
          </div>
          {txn.dateEst && (
            <div>
              <span>Estimasi Ambil</span>
              <strong>{formatDateShort(txn.dateEst)}</strong>
            </div>
          )}
        </div>

        <div className="receipt-divider" />

        <table className="receipt-items">
          <tbody>
            {txn.items.map((it) => (
              <tr key={it.rowId}>
                <td>
                  {it.name}
                  <div className="receipt-item-sub">
                    {it.calcType === "kg" ? `${it.weight} kg x ${formatRupiah(it.price)}` : `${it.qty} x ${formatRupiah(it.price)}`}
                  </div>
                </td>
                <td className="mono right">{formatRupiah(it.subtotal)}</td>
              </tr>
            ))}
            {txn.additionalFee > 0 && (
              <tr>
                <td>Biaya Tambahan</td>
                <td className="mono right">{formatRupiah(txn.additionalFee)}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="receipt-divider" />

        <div className="receipt-total-row">
          <span>TOTAL</span>
          <strong className="mono">{formatRupiah(txn.total)}</strong>
        </div>

        {txn.notes && <div className="receipt-notes">Catatan: {txn.notes}</div>}

        <div className="receipt-stamp">LUNAS</div>

        <div className="receipt-footer">{settings.footerNote}</div>
      </div>
      <div className="receipt-notch-row">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="notch" />
        ))}
      </div>
    </div>
  );
}

function InvoicePrintArea({ txn, settings }) {
  return (
    <div id="print-area">
      <ReceiptPreview txn={txn} settings={settings} />
    </div>
  );
}

/* ================= STYLES ================= */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

      #app-root {
        --bg: #FAF7F0;
        --card: #FFFFFF;
        --ink: #2B2B26;
        --ink-soft: #6B7570;
        --line: #E4DFD3;
        --primary: #245C57;
        --primary-dark: #163E3B;
        --aqua: #7FB8B0;
        --gold: #C99A3C;
        --danger: #B4553F;
        --danger-bg: #F7E9E5;
        font-family: 'Inter', sans-serif;
        color: var(--ink);
        background: var(--bg);
        min-height: 100vh;
      }
      #app-root * { box-sizing: border-box; }
      #print-area { display: none; }

      @media print {
        #app-content { display: none !important; }
        #print-area { display: block !important; padding: 0; }
      }

      .app-header {
        background: var(--primary);
        color: #fff;
        padding: 18px 20px;
      }
      .app-header-inner {
        max-width: 900px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .brand { display: flex; align-items: center; gap: 12px; }
      .brand-icon {
        width: 42px; height: 42px;
        border-radius: 12px;
        background: rgba(255,255,255,0.15);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .brand h1 {
        font-family: 'Fraunces', serif;
        font-size: 20px;
        font-weight: 600;
        margin: 0;
        letter-spacing: 0.2px;
      }
      .brand p { margin: 2px 0 0; font-size: 12.5px; color: rgba(255,255,255,0.75); }

      .save-flash {
        display: flex; align-items: center; gap: 6px;
        background: rgba(255,255,255,0.15);
        padding: 6px 12px; border-radius: 999px;
        font-size: 12.5px; opacity: 0; transform: translateY(-4px);
        transition: all 0.25s ease;
      }
      .save-flash.show { opacity: 1; transform: translateY(0); }

      .tab-nav {
        background: var(--card);
        border-bottom: 1px solid var(--line);
        position: sticky; top: 0; z-index: 10;
      }
      .tab-nav-inner {
        max-width: 900px; margin: 0 auto;
        display: flex; gap: 4px; padding: 8px 16px;
        overflow-x: auto;
      }
      .tab-btn {
        display: flex; align-items: center; gap: 7px;
        padding: 9px 14px; border: none; background: transparent;
        border-radius: 10px; font-size: 13.5px; font-weight: 500;
        color: var(--ink-soft); cursor: pointer; white-space: nowrap;
        transition: all 0.15s ease;
      }
      .tab-btn:hover { background: #F1EEE5; color: var(--ink); }
      .tab-btn.active { background: var(--primary); color: #fff; }

      .main-wrap { max-width: 900px; margin: 0 auto; padding: 20px 16px 60px; }

      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 22px;
        margin-bottom: 16px;
      }
      .card-title {
        font-family: 'Fraunces', serif;
        font-size: 19px; font-weight: 600; margin: 0 0 4px;
      }
      .card-subtitle {
        font-family: 'Fraunces', serif;
        font-size: 15px; font-weight: 600; margin: 0 0 14px;
      }
      .hint-text { color: var(--ink-soft); font-size: 12.5px; margin: 0 0 18px; }

      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
      .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px; }
      @media (max-width: 640px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }

      .field { display: flex; flex-direction: column; gap: 6px; }
      .field-label { font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
      .field-label-sm { font-size: 11px; color: var(--ink-soft); margin-bottom: 3px; display: block; }

      .input {
        border: 1px solid var(--line);
        border-radius: 9px;
        padding: 9px 11px;
        font-size: 13.5px;
        font-family: 'Inter', sans-serif;
        color: var(--ink);
        background: #FDFCF9;
        width: 100%;
        outline: none;
        transition: border-color 0.15s ease;
      }
      .input:focus { border-color: var(--primary); background: #fff; }

      .items-section { margin: 18px 0; }
      .items-header {
        display: flex; align-items: center; justify-content: space-between;
        font-size: 13px; font-weight: 600; color: var(--ink-soft);
        margin-bottom: 10px;
      }

      .btn-ghost {
        display: flex; align-items: center; gap: 5px;
        background: none; border: 1px dashed var(--aqua);
        color: var(--primary); font-size: 12.5px; font-weight: 600;
        padding: 6px 11px; border-radius: 8px; cursor: pointer;
      }
      .btn-ghost:hover { background: #EEF6F4; }

      .item-row {
        display: flex; align-items: flex-end; gap: 10px;
        padding: 12px; background: #FAF8F2; border-radius: 12px;
        margin-bottom: 8px; flex-wrap: wrap;
      }
      .item-row-type { flex-shrink: 0; }
      .pill-toggle { display: flex; background: #ECE7DA; border-radius: 8px; padding: 2px; }
      .pill {
        border: none; background: transparent; padding: 7px 10px;
        font-size: 12px; font-weight: 600; border-radius: 6px; cursor: pointer;
        color: var(--ink-soft);
      }
      .pill.active { background: var(--primary); color: #fff; }
      .item-row-field { display: flex; flex-direction: column; min-width: 90px; }
      .item-row-field.grow { flex: 1; min-width: 140px; }
      .item-row-subtotal {
        font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600;
        color: var(--primary-dark); min-width: 100px; text-align: right; margin-left: auto;
      }

      .icon-btn {
        border: none; background: #F1EEE5; color: var(--ink-soft);
        width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .icon-btn:hover { background: #E4DFD3; }
      .icon-btn.danger { color: var(--danger); background: var(--danger-bg); }
      .icon-btn.danger:hover { background: #F0D9D2; }

      .total-bar {
        display: flex; justify-content: space-between; align-items: center;
        background: var(--primary); color: #fff; padding: 14px 18px;
        border-radius: 12px; margin: 16px 0; font-size: 14px;
      }
      .total-bar strong { font-family: 'IBM Plex Mono', monospace; font-size: 19px; }

      .error-msg {
        background: var(--danger-bg); color: var(--danger);
        padding: 9px 12px; border-radius: 8px; font-size: 12.5px; margin-bottom: 12px;
      }

      .btn-primary {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        background: var(--gold); color: #3A2A05; border: none;
        padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 700;
        cursor: pointer; transition: filter 0.15s ease;
      }
      .btn-primary:hover { filter: brightness(0.95); }
      .btn-full { width: 100%; }
      .btn-secondary {
        background: #F1EEE5; color: var(--ink); border: none;
        padding: 12px 18px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;
      }

      .history-toolbar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
      .search-box {
        flex: 1; min-width: 200px; display: flex; align-items: center; gap: 8px;
        border: 1px solid var(--line); border-radius: 9px; padding: 9px 12px; background: #FDFCF9;
      }
      .search-box input { border: none; outline: none; background: transparent; font-size: 13.5px; width: 100%; color: var(--ink); }
      .status-filter { max-width: 170px; }

      .table-wrap { overflow-x: auto; }
      .txn-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .txn-table th {
        text-align: left; padding: 10px 8px; font-size: 11.5px; text-transform: uppercase;
        letter-spacing: 0.4px; color: var(--ink-soft); border-bottom: 1px solid var(--line);
      }
      .txn-table td { padding: 11px 8px; border-bottom: 1px solid #F1EEE5; vertical-align: middle; }
      .mono { font-family: 'IBM Plex Mono', monospace; }
      .cell-strong { font-weight: 600; }
      .cell-sub { font-size: 11.5px; color: var(--ink-soft); display: flex; align-items: center; gap: 3px; margin-top: 2px; }
      .row-actions { display: flex; gap: 6px; }

      .status-pill {
        border: none; border-radius: 999px; padding: 5px 10px; font-size: 11.5px; font-weight: 600;
        cursor: pointer; outline: none;
      }
      .status-Diproses { background: #FBEBD4; color: #8A5A16; }
      .status-SiapDiambil { background: #DCEBF5; color: #235E86; }
      .status-Selesai { background: #DCEEE5; color: #1F6B45; }

      .empty-state {
        display: flex; flex-direction: column; align-items: center; gap: 8px;
        padding: 40px 0; color: var(--ink-soft); text-align: center;
      }
      .empty-state p { margin: 0; font-size: 13px; }

      .period-tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
      .period-btn {
        border: 1px solid var(--line); background: #fff; padding: 7px 14px;
        border-radius: 999px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); cursor: pointer;
      }
      .period-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }

      .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
      @media (max-width: 640px) { .stat-grid { grid-template-columns: 1fr; } }
      .stat-card {
        background: var(--card); border: 1px solid var(--line); border-radius: 14px;
        padding: 16px 18px; display: flex; flex-direction: column; gap: 6px;
      }
      .stat-label { font-size: 12px; color: var(--ink-soft); font-weight: 500; }
      .stat-value { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; color: var(--primary-dark); }

      .chart-card { padding-bottom: 8px; }

      .service-breakdown { display: flex; flex-direction: column; gap: 2px; }
      .service-row {
        display: flex; align-items: center; gap: 10px; padding: 10px 4px;
        border-bottom: 1px solid #F1EEE5; font-size: 13px;
      }
      .service-name { flex: 1; font-weight: 600; }
      .service-count { color: var(--ink-soft); font-size: 12px; }
      .service-total { font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: var(--primary-dark); }

      .price-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
      .price-row .input:first-child { flex: 2; }
      .price-row .input:nth-child(2) { flex: 1; }

      .modal-overlay {
        position: fixed; inset: 0; background: rgba(30,28,20,0.55);
        display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px;
      }
      .modal-box {
        background: #EDEAE0; border-radius: 18px; max-width: 400px; width: 100%;
        max-height: 88vh; display: flex; flex-direction: column; overflow: hidden;
      }
      .modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px; border-bottom: 1px solid var(--line);
      }
      .modal-header h3 { margin: 0; font-family: 'Fraunces', serif; font-size: 16px; }
      .modal-body { padding: 16px; overflow-y: auto; }
      .modal-footer { display: flex; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--line); }
      .modal-footer .btn-primary, .modal-footer .btn-secondary { flex: 1; }

      /* Receipt / faktur styling */
      .receipt {
        background: #fff; border-radius: 6px; overflow: hidden;
        font-family: 'IBM Plex Mono', monospace; color: #262420;
        box-shadow: 0 2px 14px rgba(0,0,0,0.08);
      }
      .receipt-notch-row { display: flex; justify-content: space-between; padding: 0 6px; background: #EDEAE0; }
      .notch { width: 8px; height: 8px; border-radius: 50%; background: #EDEAE0; box-shadow: 0 0 0 4px #fff inset; margin-top: -4px; }
      .receipt-body { padding: 18px 20px 22px; }
      .receipt-brand { display: flex; align-items: flex-start; gap: 10px; color: var(--primary-dark); }
      .receipt-brand-name { font-family: 'Fraunces', serif; font-weight: 700; font-size: 16px; }
      .receipt-brand-sub { font-size: 10.5px; color: #7A7568; }
      .receipt-divider { border-top: 1px dashed #C9C3B2; margin: 12px 0; }
      .receipt-meta { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; }
      .receipt-meta > div { display: flex; justify-content: space-between; gap: 10px; }
      .receipt-meta span { color: #7A7568; }
      .receipt-items { width: 100%; border-collapse: collapse; font-size: 11.5px; }
      .receipt-items td { padding: 6px 0; vertical-align: top; }
      .receipt-item-sub { font-size: 10px; color: #8B8676; margin-top: 1px; }
      .right { text-align: right; }
      .receipt-total-row { display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; font-weight: 700; }
      .receipt-total-row strong { font-size: 17px; color: var(--primary-dark); }
      .receipt-notes { font-size: 10.5px; color: #7A7568; margin-top: 10px; font-style: italic; }
      .receipt-stamp {
        display: inline-block; margin: 16px auto 6px; border: 2.5px solid var(--gold); color: var(--gold);
        font-weight: 700; font-size: 13px; padding: 4px 14px; border-radius: 6px; transform: rotate(-6deg);
        letter-spacing: 1.5px;
      }
      .receipt-footer { text-align: center; font-size: 10.5px; color: #8B8676; margin-top: 8px; }

      @media print {
        body { margin: 0; }
        .receipt { box-shadow: none; width: 320px; margin: 0 auto; }
      }
    `}</style>
  );
}
