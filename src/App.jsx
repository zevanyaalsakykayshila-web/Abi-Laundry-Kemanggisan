import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { storage } from "./storage";
import { supabase } from "./supabaseClient";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
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
  LayoutDashboard,
  FileSpreadsheet,
  Wallet,
  Lock,
  LogOut,
  MessageCircle,
  Share2,
  Users,
  Camera,
  Truck,
  MapPin,
  CalendarClock,
  XCircle,
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
const STORAGE_PICKUP = "bersih_laundry_pickup_requests_v1";
const MAX_PHOTOS = 10;
const PICKUP_TIME_SLOTS = ["Pagi (09.00–12.00)", "Siang (12.00–15.00)", "Sore (15.00–18.00)", "Malam (18.00–20.00)"];
const LOGIN_AT_KEY = "abi_laundry_login_at";
const SESSION_MAX_AGE_MS = 60 * 60 * 1000; // 1 jam

const STATUS_FLOW = ["Diproses", "Siap Diambil"];
const PAYMENT_STATUSES = ["Belum Bayar", "Kurang Bayar", "Lunas"];
const PRINT_SIZES = [
  { id: "58mm", label: "Struk Thermal 58mm" },
  { id: "80mm", label: "Struk Thermal 80mm" },
  { id: "a5", label: "Kertas A5" },
  { id: "a4", label: "Kertas A4" },
];

const defaultSettings = {
  businessName: "Abi Laundry Kemanggisan",
  ownerNote: "Laundry Kiloan & Satuan",
  address: "Jl. Anggrek Rosliana No.9, RT.9/RW.5, Kemanggisan, Palmerah, Jakarta Barat",
  phone: "0896-3402-3067",
  hours: "Setiap hari 09.30 – 20.30",
  services: [
    { id: "svc1", name: "Cuci Komplit", pricePerKg: 6500 },
    { id: "svc2", name: "Cuci Lipat", pricePerKg: 5000 },
    { id: "svc3", name: "Cuci Gosok", pricePerKg: 5000 },
    { id: "svc4", name: "Cuci Express", pricePerKg: 10000 },
  ],
  freeDeliveryMinKg: 3,
  roundingEnabled: true,
  fontScale: 1,
  itemPrices: [
    { id: "it1", name: "Selimut", price: 20000 },
    { id: "it2", name: "Bed Cover", price: 25000 },
    { id: "it3", name: "Jaket Tebal", price: 15000 },
    { id: "it4", name: "Sprei", price: 12000 },
    { id: "it5", name: "Gorden", price: 18000 },
  ],
  footerNote: "Terima kasih sudah mempercayakan cucian Anda ke kami :)",
  printSize: "80mm",
  receiptFields: {
    showAddress: true,
    showPhone: true,
    showHours: true,
    showCustomerPhone: true,
    showEstCompletion: true,
    showItemDetail: true,
    showNotes: true,
    showStamp: true,
    showFooterNote: true,
    showPhoto: true,
  },
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

function compressImageFile(file, maxWidth = 480, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result || "";
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makeInvoiceNo(count) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `INV-${ymd}-${String(count + 1).padStart(3, "0")}`;
}

function toWhatsappPhone(phone) {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  return digits;
}

function buildWhatsappInvoiceText(txn, settings) {
  const lines = [];
  lines.push(`*${settings.businessName}*`);
  lines.push(`No. Faktur: ${txn.invoiceNo}`);
  lines.push(`Tanggal Masuk: ${formatDateShort(txn.dateIn)}`);
  if (txn.dateEst) lines.push(`Estimasi Selesai: ${formatDateShort(txn.dateEst)}`);
  lines.push("");
  lines.push("Rincian:");
  txn.items.forEach((it) => {
    const detail =
      it.calcType === "kg" ? `${it.weight} kg x ${formatRupiah(it.price)}` : `${it.qty} x ${formatRupiah(it.price)}`;
    lines.push(`- ${it.name} (${detail}) = ${formatRupiah(it.subtotal)}`);
  });
  if (txn.additionalFee > 0) lines.push(`- Biaya Tambahan = ${formatRupiah(txn.additionalFee)}`);
  lines.push("");
  if (txn.roundingAmount) {
    lines.push(`Subtotal: ${formatRupiah(txn.subtotalAmount)}`);
    lines.push(`Pembulatan: ${txn.roundingAmount > 0 ? "+" : "-"}${formatRupiah(Math.abs(txn.roundingAmount))}`);
  }
  lines.push(`*TOTAL: ${formatRupiah(txn.total)}*`);
  lines.push(`Status Bayar: ${txn.paymentStatus || "Lunas"}`);
  lines.push("");
  lines.push("Pantau status pesanan Anda (sedang diproses / siap diambil) kapan saja di:");
  lines.push("https://abilaundrykemanggisan.my.id/lacak");
  lines.push(`Cukup masukkan No. Faktur: ${txn.invoiceNo}`);
  lines.push("");
  lines.push(settings.footerNote || "Terima kasih!");
  return lines.join("\n");
}

function buildWhatsappLink(txn, settings) {
  const phone = toWhatsappPhone(txn.phone);
  const text = encodeURIComponent(buildWhatsappInvoiceText(txn, settings));
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

// window.open(..., "_blank") tidak selalu andal untuk link wa.me di dalam aplikasi
// yang sudah di-install sebagai PWA di Android (kadang WhatsApp kebuka dengan pesan
// kosong). Navigasi di tab yang sama (window.location.href) jauh lebih konsisten.
function openWhatsapp(link) {
  window.location.href = link;
}

function emptyItemRow(settings) {
  const firstService = settings.services?.[0];
  return {
    rowId: uid("row"),
    calcType: "kg",
    name: firstService ? `Cucian Kiloan - ${firstService.name}` : "Cucian Kiloan",
    serviceId: firstService?.id || "",
    weight: "",
    qty: 1,
    price: firstService?.pricePerKg ?? 0,
  };
}

function rowSubtotal(row) {
  if (row.calcType === "kg") {
    return (Number(row.weight) || 0) * (Number(row.price) || 0);
  }
  return (Number(row.qty) || 0) * (Number(row.price) || 0);
}

export default function LaundryApp() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out, object = logged in
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);
  const [transactions, setTransactions] = useState([]);
  const [pickupRequests, setPickupRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("baru");
  const [saveFlash, setSaveFlash] = useState("");
  const [printingTxn, setPrintingTxn] = useState(null);

  // ---------- auth session (kadaluarsa otomatis setelah 1 jam) ----------
  useEffect(() => {
    const checkExpiry = () => {
      const loginAt = Number(localStorage.getItem(LOGIN_AT_KEY) || 0);
      if (loginAt && Date.now() - loginAt > SESSION_MAX_AGE_MS) {
        localStorage.removeItem(LOGIN_AT_KEY);
        supabase.auth.signOut();
      }
    };

    checkExpiry();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !localStorage.getItem(LOGIN_AT_KEY)) {
        localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
      }
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "SIGNED_IN") {
        localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
      }
      if (event === "SIGNED_OUT") {
        localStorage.removeItem(LOGIN_AT_KEY);
      }
      setSession(newSession);
    });

    const interval = setInterval(checkExpiry, 60 * 1000);
    return () => {
      listener.subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // ---------- load from persistent storage ----------
  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        let s = defaultSettings;
        let t = [];
        try {
          const r = await storage.get(STORAGE_SETTINGS);
          if (r && r.value) {
            const parsed = JSON.parse(r.value);
            s = {
              ...defaultSettings,
              ...parsed,
              receiptFields: { ...defaultSettings.receiptFields, ...(parsed.receiptFields || {}) },
            };
          }
        } catch (e) {
          /* no settings yet */
        }
        try {
          const r2 = await storage.get(STORAGE_TRANSACTIONS);
          if (r2 && r2.value) t = JSON.parse(r2.value);
        } catch (e) {
          /* no transactions yet */
        }
        let p = [];
        try {
          const r3 = await storage.get(STORAGE_PICKUP);
          if (r3 && r3.value) p = JSON.parse(r3.value);
        } catch (e) {
          /* no pickup requests yet */
        }
        setSettings(s);
        setTransactions(t);
        setPickupRequests(p);
      } finally {
        setLoaded(true);
      }
    })();
  }, [session]);

  // ---------- persist on change ----------
  useEffect(() => {
    if (!loaded) return;
    storage.set(STORAGE_SETTINGS, JSON.stringify(settings)).catch(() => {});
  }, [settings, loaded]);

  useEffect(() => {
    if (!loaded) return;
    storage.set(STORAGE_TRANSACTIONS, JSON.stringify(transactions)).catch(() => {});
  }, [transactions, loaded]);

  useEffect(() => {
    if (!loaded) return;
    storage.set(STORAGE_PICKUP, JSON.stringify(pickupRequests)).catch(() => {});
  }, [pickupRequests, loaded]);

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

  const updateTransactionPayment = (id, paymentStatus) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, paymentStatus } : t)));
  };

  const deleteTransaction = (id) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const updatePickupRequest = (id, patch) => {
    setPickupRequests((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const deletePickupRequest = (id) => {
    setPickupRequests((prev) => prev.filter((p) => p.id !== id));
  };

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: "#5b6b68" }}>
        Memeriksa sesi login...
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

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
      <div id="app-content" style={{ zoom: settings.fontScale || 1 }}>
        <Header settings={settings} saveFlash={saveFlash} onLogout={() => supabase.auth.signOut()} />
        <NavTabs
          active={activeTab}
          setActive={setActiveTab}
          pickupBadge={pickupRequests.filter((p) => p.status === "Baru").length}
        />
        <main className="main-wrap">
          {activeTab === "baru" && (
            <NewTransactionTab
              settings={settings}
              transactions={transactions}
              onSave={(txn) => {
                addTransaction(txn);
                setPrintingTxn(txn);
              }}
            />
          )}
          {activeTab === "riwayat" && (
            <HistoryTab
              transactions={transactions}
              settings={settings}
              onPrint={setPrintingTxn}
              onDelete={deleteTransaction}
              onStatusChange={updateTransactionStatus}
              onPaymentChange={updateTransactionPayment}
            />
          )}
          {activeTab === "jemput" && (
            <PickupRequestsTab
              requests={pickupRequests}
              onUpdate={updatePickupRequest}
              onDelete={deletePickupRequest}
            />
          )}
          {activeTab === "pelanggan" && (
            <CustomersTab transactions={transactions} onPrint={setPrintingTxn} />
          )}
          {activeTab === "dashboard" && <DashboardTab transactions={transactions} />}
          {activeTab === "jadwal" && <ScheduleTab transactions={transactions} onPrint={setPrintingTxn} />}
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

const AUTH_EMAIL_DOMAIN = "abilaundry.local";

function usernameToAuthEmail(username) {
  return `${username.trim().toLowerCase().replace(/\s+/g, "")}@${AUTH_EMAIL_DOMAIN}`;
}

function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Username dan password wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: usernameToAuthEmail(username),
      password,
    });
    setLoading(false);
    if (authError) {
      setError("Username atau password salah.");
    }
  };

  return (
    <div id="app-root">
      <GlobalStyle />
      <div className="login-wrap">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-icon">
            <Lock size={22} />
          </div>
          <h1 className="login-title">Abi Laundry Kemanggisan</h1>
          <p className="login-sub">Masuk untuk mengakses aplikasi pencatatan transaksi.</p>

          <Field label="Username">
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="mis. admin"
              autoComplete="username"
            />
          </Field>
          <Field label="Password">
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Field>

          {error && <div className="error-msg">{error}</div>}

          <button className="btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ================= HEADER & NAV ================= */

function Header({ settings, saveFlash, onLogout }) {
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
        <div className="header-right">
          <div className={`save-flash ${saveFlash ? "show" : ""}`}>
            <CheckCircle2 size={15} />
            <span>{saveFlash}</span>
          </div>
          <button className="logout-btn" onClick={onLogout} type="button" title="Keluar">
            <LogOut size={15} />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function NavTabs({ active, setActive, pickupBadge }) {
  const tabs = [
    { id: "baru", label: "Transaksi Baru", icon: Plus },
    { id: "riwayat", label: "Riwayat", icon: ClipboardList },
    { id: "jemput", label: "Jemput", icon: Truck, badge: pickupBadge },
    { id: "dashboard", label: "Dashboard Pekerjaan", icon: LayoutDashboard },
    { id: "jadwal", label: "Jadwal", icon: Calendar },
    { id: "rekap", label: "Rekap Penjualan", icon: TrendingUp },
    { id: "pelanggan", label: "Pelanggan", icon: Users },
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
              {!!t.badge && <span className="tab-badge">{t.badge}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ================= TAB: TRANSAKSI BARU ================= */

function NewTransactionTab({ settings, transactions, onSave }) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateIn, setDateIn] = useState(todayISO());
  const [dateEst, setDateEst] = useState("");
  const [items, setItems] = useState([emptyItemRow(settings)]);
  const [additionalFee, setAdditionalFee] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Belum Bayar");
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState([]);
  const [photoLoading, setPhotoLoading] = useState(false);

  const handlePhotoChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`Maksimal ${MAX_PHOTOS} foto per transaksi.`);
      e.target.value = "";
      return;
    }
    const toProcess = files.slice(0, room);
    setPhotoLoading(true);
    try {
      const compressed = await Promise.all(toProcess.map((f) => compressImageFile(f).catch(() => null)));
      setPhotos((prev) => [...prev, ...compressed.filter(Boolean)]);
    } catch (err) {
      /* gagal baca file, biarkan yang berhasil saja masuk */
    } finally {
      setPhotoLoading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const customers = useMemo(() => {
    const seen = new Map();
    transactions.forEach((t) => {
      const key = t.customerName.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, { name: t.customerName, phone: t.phone || "" });
    });
    return Array.from(seen.values());
  }, [transactions]);

  const handleCustomerNameChange = (value) => {
    setCustomerName(value);
    if (!phone) {
      const match = customers.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());
      if (match && match.phone) setPhone(match.phone);
    }
  };

  const subtotal = useMemo(() => {
    const itemsTotal = items.reduce((sum, r) => sum + rowSubtotal(r), 0);
    return itemsTotal + (Number(additionalFee) || 0);
  }, [items, additionalFee]);

  const roundingEnabled = settings.roundingEnabled !== false;
  const total = roundingEnabled ? Math.round(subtotal / 1000) * 1000 : subtotal;
  const roundingAmount = total - subtotal;

  const totalWeightKg = useMemo(
    () => items.filter((r) => r.calcType === "kg").reduce((sum, r) => sum + (Number(r.weight) || 0), 0),
    [items]
  );
  const freeDeliveryMin = settings.freeDeliveryMinKg || 0;
  const isFreeDeliveryEligible = freeDeliveryMin > 0 && totalWeightKg >= freeDeliveryMin;

  const updateRow = (rowId, patch) => {
    setItems((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };

  const addRow = () => setItems((prev) => [...prev, emptyItemRow(settings)]);
  const removeRow = (rowId) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));

  const handleItemNameSelect = (rowId, itemId) => {
    const found = settings.itemPrices.find((i) => i.id === itemId);
    if (found) {
      updateRow(rowId, { name: `Cucian Satuan - ${found.name}`, price: found.price, itemId });
    }
  };

  const handleServiceSelect = (rowId, serviceId) => {
    const found = settings.services.find((s) => s.id === serviceId);
    if (found) {
      updateRow(rowId, { name: `Cucian Kiloan - ${found.name}`, price: found.pricePerKg, serviceId: found.id });
    }
  };

  const resetForm = () => {
    setCustomerName("");
    setPhone("");
    setDateIn(todayISO());
    setDateEst("");
    setItems([emptyItemRow(settings)]);
    setAdditionalFee("");
    setNotes("");
    setPaymentStatus("Belum Bayar");
    setPhotos([]);
  };

  const handleSubmit = () => {
    if (!customerName.trim()) {
      setError("Nama pelanggan wajib diisi.");
      return;
    }
    if (!dateEst) {
      setError("Estimasi tanggal selesai/ambil wajib diisi.");
      return;
    }
    if (total <= 0) {
      setError("Isi minimal satu item dengan berat/jumlah yang valid.");
      return;
    }
    setError("");
    const kgServiceNames = Array.from(
      new Set(items.filter((r) => r.calcType === "kg").map((r) => r.name.replace(/^Cucian Kiloan - /, "")))
    );
    const serviceSummary = kgServiceNames.length > 0 ? kgServiceNames.join(", ") : "Satuan";
    const txn = {
      id: uid("txn"),
      invoiceNo: makeInvoiceNo(transactions.length),
      customerName: customerName.trim(),
      phone: phone.trim(),
      serviceType: serviceSummary,
      dateIn,
      dateEst,
      items: items.map((r) => ({ ...r, subtotal: rowSubtotal(r) })),
      additionalFee: Number(additionalFee) || 0,
      notes: notes.trim(),
      subtotalAmount: subtotal,
      roundingAmount,
      total,
      status: "Diproses",
      paymentStatus,
      photos,
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
            onChange={(e) => handleCustomerNameChange(e.target.value)}
            placeholder="Contoh: Bu Sari"
            list="customer-suggestions"
            autoComplete="off"
          />
          <datalist id="customer-suggestions">
            {customers.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
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

      <div className="grid-2">
        <Field label="Tanggal Masuk">
          <input className="input" type="date" value={dateIn} onChange={(e) => setDateIn(e.target.value)} />
        </Field>
        <Field label="Estimasi Selesai/Ambil *">
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
            onSelectService={(serviceId) => handleServiceSelect(row.rowId, serviceId)}
            onRemove={() => removeRow(row.rowId)}
          />
        ))}

        {freeDeliveryMin > 0 && totalWeightKg > 0 && (
          <p className={`free-delivery-note ${isFreeDeliveryEligible ? "eligible" : ""}`}>
            Total kiloan: {totalWeightKg} kg —{" "}
            {isFreeDeliveryEligible
              ? "sudah dapat gratis antar-jemput ✓"
              : `butuh ${(freeDeliveryMin - totalWeightKg).toFixed(1)} kg lagi untuk gratis antar-jemput`}
          </p>
        )}
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

      {roundingEnabled && roundingAmount !== 0 && (
        <div className="rounding-summary">
          <div className="rounding-row">
            <span>Subtotal</span>
            <span className="mono">{formatRupiah(subtotal)}</span>
          </div>
          <div className="rounding-row">
            <span>Pembulatan</span>
            <span className="mono">
              {roundingAmount > 0 ? "+" : "-"}
              {formatRupiah(Math.abs(roundingAmount))}
            </span>
          </div>
        </div>
      )}

      <div className="total-bar">
        <span>Total Tagihan</span>
        <strong>{formatRupiah(total)}</strong>
      </div>

      <Field label="Status Pembayaran">
        <label className="pill-toggle wide">
          {PAYMENT_STATUSES.map((p) => (
            <button
              key={p}
              type="button"
              className={paymentStatus === p ? "pill active" : "pill"}
              onClick={() => setPaymentStatus(p)}
            >
              {p}
            </button>
          ))}
        </label>
      </Field>

      <Field label={`Foto Timbangan / Bukti (opsional, maks ${MAX_PHOTOS})`}>
        <div className="photo-grid">
          {photos.map((p, i) => (
            <div className="photo-preview" key={i}>
              <img src={p} alt={`Foto bukti ${i + 1}`} />
              <button className="icon-btn danger photo-remove" onClick={() => removePhoto(i)} type="button">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="photo-upload-btn photo-upload-tile">
              <Camera size={20} />
              <span>{photoLoading ? "Memproses..." : "Tambah Foto"}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoChange}
                disabled={photoLoading}
                hidden
              />
            </label>
          )}
        </div>
        {photos.length > 0 && (
          <span className="photo-count-hint">
            {photos.length}/{MAX_PHOTOS} foto
          </span>
        )}
      </Field>

      {error && <div className="error-msg">{error}</div>}

      <button className="btn-primary btn-full" onClick={handleSubmit}>
        <Save size={16} /> Simpan &amp; Buat Faktur
      </button>
    </div>
  );
}

function ItemRow({ row, settings, onChange, onSelectItem, onSelectService, onRemove }) {
  return (
    <div className="item-row">
      <div className="item-row-type">
        <label className="pill-toggle">
          <button
            className={row.calcType === "kg" ? "pill active" : "pill"}
            onClick={() => {
              const firstService = settings.services?.[0];
              onChange({
                calcType: "kg",
                name: firstService ? `Cucian Kiloan - ${firstService.name}` : "Cucian Kiloan",
                price: firstService?.pricePerKg ?? 0,
                serviceId: firstService?.id || "",
              });
            }}
            type="button"
          >
            Kiloan
          </button>
          <button
            className={row.calcType === "pcs" ? "pill active" : "pill"}
            onClick={() =>
              onChange({
                calcType: "pcs",
                name: settings.itemPrices[0] ? `Cucian Satuan - ${settings.itemPrices[0].name}` : "Cucian Satuan",
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
          <div className="item-row-field grow">
            <span className="field-label-sm">Jenis Kiloan</span>
            <select
              className="input"
              value={row.serviceId || ""}
              onChange={(e) => onSelectService(e.target.value)}
            >
              {settings.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatRupiah(s.pricePerKg)}/kg)
                </option>
              ))}
            </select>
          </div>
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

function exportTransactionsToExcel(transactions) {
  const rows = transactions.map((t) => ({
    "No. Faktur": t.invoiceNo,
    Tanggal: formatDateShort(t.dateIn),
    Pelanggan: t.customerName,
    "No. HP": t.phone || "",
    Layanan: t.serviceType,
    "Status Proses": t.status,
    "Status Bayar": t.paymentStatus || "Lunas",
    "Biaya Tambahan": t.additionalFee || 0,
    Total: t.total,
    Catatan: t.notes || "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 13 }, { wch: 15 }, { wch: 14 }, { wch: 24 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
  XLSX.writeFile(wb, `Rekap-Transaksi-${todayISO()}.xlsx`);
}

function HistoryTab({ transactions, settings, onPrint, onDelete, onStatusChange, onPaymentChange }) {
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
        <button
          className="btn-ghost"
          type="button"
          onClick={() => exportTransactionsToExcel(filtered)}
          disabled={filtered.length === 0}
        >
          <FileSpreadsheet size={15} /> Export ke Excel
        </button>
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
                <th>Bayar</th>
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
                    <select
                      className={`payment-pill payment-${(t.paymentStatus || "Lunas").replace(/\s/g, "")}`}
                      value={t.paymentStatus || "Lunas"}
                      onChange={(e) => onPaymentChange(t.id, e.target.value)}
                    >
                      {PAYMENT_STATUSES.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => onPrint(t)} aria-label="Cetak">
                        <Printer size={15} />
                      </button>
                      <button
                        className="icon-btn whatsapp"
                        onClick={() => openWhatsapp(buildWhatsappLink(t, settings))}
                        aria-label="Kirim WhatsApp"
                        disabled={!t.phone}
                      >
                        <MessageCircle size={15} />
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

/* ================= TAB: JEMPUT ================= */

const PICKUP_STATUSES = ["Baru", "Dijadwalkan Ulang", "Ditolak", "Selesai"];

function PickupRequestsTab({ requests, onUpdate, onDelete }) {
  const [filter, setFilter] = useState("Baru");
  const [actionFor, setActionFor] = useState(null); // { id, mode: 'reschedule' | 'reject' }

  const filtered = useMemo(() => {
    const list = filter === "Semua" ? requests : requests.filter((p) => p.status === filter);
    return [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [requests, filter]);

  const closeAction = () => setActionFor(null);

  return (
    <div className="card">
      <div className="history-toolbar">
        <h2 className="card-title" style={{ marginBottom: 0 }}>
          Permintaan Penjemputan
        </h2>
        <select className="input status-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {PICKUP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="Semua">Semua</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="Tidak ada permintaan penjemputan di sini." />
      ) : (
        <div className="pickup-list">
          {filtered.map((p) => (
            <div className="pickup-card" key={p.id}>
              <div className="pickup-card-top">
                <div>
                  <div className="cell-strong">{p.name}</div>
                  <div className="cell-sub">
                    <Phone size={11} /> {p.phone}
                  </div>
                </div>
                <div className="pickup-card-top-right">
                  {p.code && <span className="pickup-code-badge mono">{p.code}</span>}
                  <span className={`pickup-status-badge pickup-status-${p.status.replace(/\s/g, "")}`}>
                    {p.status}
                  </span>
                </div>
              </div>
              <div className="pickup-card-row">
                <MapPin size={13} /> {p.address}
              </div>
              <div className="pickup-card-row">
                <Calendar size={13} /> {formatDateShort(p.date)} • {p.timeSlot}
              </div>
              {p.notes && <div className="pickup-card-notes">Catatan pelanggan: {p.notes}</div>}
              {p.adminNote && (
                <div className="pickup-card-notes pickup-card-adminnote">Catatan kami: {p.adminNote}</div>
              )}

              {actionFor?.id === p.id ? (
                <PickupActionForm
                  request={p}
                  mode={actionFor.mode}
                  onCancel={closeAction}
                  onSubmit={(patch) => {
                    onUpdate(p.id, patch);
                    closeAction();
                  }}
                />
              ) : (
                <div className="pickup-card-actions">
                  <button
                    className="icon-btn whatsapp"
                    onClick={() =>
                      openWhatsapp(
                        `https://wa.me/${toWhatsappPhone(p.phone)}?text=${encodeURIComponent(
                          `Halo ${p.name}, terkait jadwal penjemputan tanggal ${formatDateShort(p.date)} (${p.timeSlot}) ya`
                        )}`
                      )
                    }
                    aria-label="Hubungi via WhatsApp"
                  >
                    <MessageCircle size={15} />
                  </button>
                  {p.status !== "Selesai" && p.status !== "Ditolak" && (
                    <>
                      <button
                        className="btn-ghost"
                        type="button"
                        onClick={() => onUpdate(p.id, { status: "Selesai" })}
                      >
                        <CheckCircle2 size={14} /> Tandai Selesai
                      </button>
                      <button
                        className="btn-ghost"
                        type="button"
                        onClick={() => setActionFor({ id: p.id, mode: "reschedule" })}
                      >
                        <CalendarClock size={14} /> Jadwal Ulang
                      </button>
                      <button
                        className="btn-ghost btn-ghost-danger"
                        type="button"
                        onClick={() => setActionFor({ id: p.id, mode: "reject" })}
                      >
                        <XCircle size={14} /> Tolak
                      </button>
                    </>
                  )}
                  <button
                    className="icon-btn danger"
                    onClick={() => {
                      if (confirm(`Hapus permintaan dari ${p.name}?`)) onDelete(p.id);
                    }}
                    aria-label="Hapus"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PickupActionForm({ request, mode, onCancel, onSubmit }) {
  const [date, setDate] = useState(request.date);
  const [timeSlot, setTimeSlot] = useState(request.timeSlot);
  const [note, setNote] = useState("");

  const isReschedule = mode === "reschedule";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isReschedule) {
      onSubmit({ date, timeSlot, status: "Dijadwalkan Ulang", adminNote: note.trim() });
    } else {
      onSubmit({ status: "Ditolak", adminNote: note.trim() });
    }
  };

  return (
    <form className="pickup-action-form" onSubmit={handleSubmit}>
      <div className="pickup-action-title">
        {isReschedule ? "Jadwalkan Ulang Penjemputan" : "Tolak Permintaan"}
      </div>
      {isReschedule && (
        <div className="grid-2">
          <Field label="Tanggal Baru">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Waktu Baru">
            <select className="input" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
              {PICKUP_TIME_SLOTS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <Field label={isReschedule ? "Alasan / Catatan untuk Pelanggan (opsional)" : "Alasan Penolakan (opsional)"}>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isReschedule ? "Contoh: kurir sedang penuh, digeser sehari" : "Contoh: di luar area jangkauan"}
        />
      </Field>
      <div className="pickup-action-btns">
        <button className="btn-secondary" type="button" onClick={onCancel}>
          Batal
        </button>
        <button className={isReschedule ? "btn-primary" : "btn-whatsapp-danger"} type="submit">
          {isReschedule ? "Simpan Jadwal Baru" : "Tolak Permintaan"}
        </button>
      </div>
    </form>
  );
}

/* ================= TAB: PELANGGAN ================= */

function CustomersTab({ transactions, onPrint }) {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [sortBy, setSortBy] = useState("totalSpend");

  const customers = useMemo(() => {
    const map = new Map();
    transactions.forEach((t) => {
      const key = t.customerName.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: t.customerName,
          phone: t.phone || "",
          count: 0,
          totalSpend: 0,
          outstanding: 0,
          lastDate: t.dateIn,
          transactions: [],
        });
      }
      const c = map.get(key);
      c.count += 1;
      c.totalSpend += t.total;
      if ((t.paymentStatus || "Lunas") !== "Lunas") c.outstanding += t.total;
      if (!c.phone && t.phone) c.phone = t.phone;
      if (new Date(t.dateIn) > new Date(c.lastDate)) c.lastDate = t.dateIn;
      c.transactions.push(t);
    });
    return Array.from(map.values());
  }, [transactions]);

  const sorted = useMemo(() => {
    const arr = [...customers];
    if (sortBy === "totalSpend") arr.sort((a, b) => b.totalSpend - a.totalSpend);
    else if (sortBy === "count") arr.sort((a, b) => b.count - a.count);
    else if (sortBy === "name") arr.sort((a, b) => a.name.localeCompare(b.name, "id"));
    else if (sortBy === "lastDate") arr.sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
    return arr;
  }, [customers, sortBy]);

  const filtered = useMemo(
    () => sorted.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [sorted, query]
  );

  const selected = customers.find((c) => c.key === selectedKey);

  if (selected) {
    return <CustomerDetail customer={selected} onBack={() => setSelectedKey(null)} onPrint={onPrint} />;
  }

  return (
    <div className="card">
      <div className="history-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            placeholder="Cari nama pelanggan..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="input status-filter" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="totalSpend">Urutkan: Total Belanja</option>
          <option value="count">Urutkan: Jumlah Transaksi</option>
          <option value="lastDate">Urutkan: Transaksi Terbaru</option>
          <option value="name">Urutkan: Nama (A-Z)</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="Belum ada pelanggan." />
      ) : (
        <div className="customer-list">
          {filtered.map((c, idx) => (
            <button className="customer-row" key={c.key} onClick={() => setSelectedKey(c.key)} type="button">
              <div className="customer-rank">{idx + 1}</div>
              <div className="customer-info">
                <div className="cell-strong">{c.name}</div>
                {c.phone && (
                  <div className="cell-sub">
                    <Phone size={11} /> {c.phone}
                  </div>
                )}
              </div>
              <div className="customer-stats">
                <span className="customer-count">{c.count}x transaksi</span>
                <span className="customer-total mono">{formatRupiah(c.totalSpend)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerDetail({ customer, onBack, onPrint }) {
  const avg = customer.count > 0 ? customer.totalSpend / customer.count : 0;

  return (
    <div>
      <button className="btn-ghost back-btn" onClick={onBack} type="button">
        ← Kembali ke Daftar Pelanggan
      </button>

      <div className="card">
        <h2 className="card-title">{customer.name}</h2>
        {customer.phone && (
          <p className="hint-text">
            <Phone size={12} /> {customer.phone}
          </p>
        )}

        <div className="stat-grid customer-detail-stats">
          <div className="stat-card">
            <span className="stat-label">Total Belanja</span>
            <span className="stat-value">{formatRupiah(customer.totalSpend)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Jumlah Transaksi</span>
            <span className="stat-value">{customer.count}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Rata-rata / Transaksi</span>
            <span className="stat-value">{formatRupiah(avg)}</span>
          </div>
          {customer.outstanding > 0 && (
            <div className="stat-card stat-card-warning">
              <span className="stat-label">
                <Wallet size={13} /> Belum Lunas
              </span>
              <span className="stat-value">{formatRupiah(customer.outstanding)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="card-subtitle">Riwayat Transaksi</h3>
        <ScheduleList items={customer.transactions} onPrint={onPrint} />
      </div>
    </div>
  );
}

/* ================= TAB: DASHBOARD PEKERJAAN ================= */

function DashboardTab({ transactions }) {
  const counts = useMemo(() => {
    const map = {};
    STATUS_FLOW.forEach((s) => {
      map[s] = transactions.filter((t) => t.status === s);
    });
    return map;
  }, [transactions]);

  const belumLunas = useMemo(
    () => transactions.filter((t) => (t.paymentStatus || "Lunas") !== "Lunas"),
    [transactions]
  );
  const totalPiutang = belumLunas.reduce((s, t) => s + t.total, 0);

  return (
    <div>
      <div className="stat-grid dashboard-stat-grid">
        {STATUS_FLOW.map((s) => (
          <div className="stat-card" key={s}>
            <span className="stat-label">{s}</span>
            <span className="stat-value">{counts[s].length}</span>
          </div>
        ))}
        <div className="stat-card stat-card-warning">
          <span className="stat-label">
            <Wallet size={13} /> Piutang ({belumLunas.length})
          </span>
          <span className="stat-value">{formatRupiah(totalPiutang)}</span>
        </div>
      </div>

      <div className="kerja-board">
        {STATUS_FLOW.map((s) => (
          <div className="kerja-column" key={s}>
            <div className="kerja-column-header">
              <span>{s}</span>
              <span className="kerja-column-count">{counts[s].length}</span>
            </div>
            <div className="kerja-column-body">
              {counts[s].length === 0 && <p className="kerja-empty">Tidak ada transaksi</p>}
              {counts[s].map((t) => (
                <div className="kerja-card" key={t.id}>
                  <div className="kerja-card-top">
                    <span className="kerja-card-name">{t.customerName}</span>
                    <span
                      className={`payment-badge payment-${(t.paymentStatus || "Lunas").replace(/\s/g, "")}`}
                    >
                      {t.paymentStatus || "Lunas"}
                    </span>
                  </div>
                  <div className="kerja-card-sub mono">{t.invoiceNo}</div>
                  <div className="kerja-card-bottom">
                    <span>{formatDateShort(t.dateIn)}</span>
                    <span className="mono">{formatRupiah(t.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {transactions.length === 0 && <EmptyState text="Belum ada transaksi untuk ditampilkan." />}
    </div>
  );
}

/* ================= TAB: JADWAL ================= */

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function ScheduleTab({ transactions, onPrint }) {
  const todayStr = todayISO();
  const [viewYear, setViewYear] = useState(() => Number(todayStr.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(todayStr.slice(5, 7)) - 1);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const byDate = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      if (!t.dateEst) return;
      if (!map[t.dateEst]) map[t.dateEst] = [];
      map[t.dateEst].push(t);
    });
    return map;
  }, [transactions]);

  const overdueItems = useMemo(
    () => transactions.filter((t) => t.dateEst && t.dateEst < todayStr && t.status === "Diproses"),
    [transactions, todayStr]
  );
  const todayItems = byDate[todayStr] || [];

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const tomorrowItems = byDate[tomorrowStr] || [];

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const changeMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cellKey = (day) => `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedItems = byDate[selectedDate] || [];

  return (
    <div>
      <div className="reminder-banners">
        <button
          type="button"
          className={`reminder-card reminder-overdue ${overdueItems.length === 0 ? "muted" : ""}`}
          onClick={() => overdueItems[0] && setSelectedDate(overdueItems[0].dateEst)}
        >
          <span className="reminder-count">{overdueItems.length}</span>
          <div>
            <div className="reminder-title">Terlambat</div>
            <div className="reminder-sub">Lewat estimasi, masih Diproses</div>
          </div>
        </button>
        <button type="button" className="reminder-card reminder-today" onClick={() => setSelectedDate(todayStr)}>
          <span className="reminder-count">{todayItems.length}</span>
          <div>
            <div className="reminder-title">Hari Ini</div>
            <div className="reminder-sub">{formatDateShort(todayStr)}</div>
          </div>
        </button>
        <button
          type="button"
          className="reminder-card reminder-tomorrow"
          onClick={() => setSelectedDate(tomorrowStr)}
        >
          <span className="reminder-count">{tomorrowItems.length}</span>
          <div>
            <div className="reminder-title">Besok</div>
            <div className="reminder-sub">{formatDateShort(tomorrowStr)}</div>
          </div>
        </button>
      </div>

      {overdueItems.length > 0 && (
        <div className="card">
          <h3 className="card-subtitle">⚠️ Faktur Terlambat ({overdueItems.length})</h3>
          <ScheduleList items={overdueItems} onPrint={onPrint} />
        </div>
      )}

      <div className="card calendar-card">
        <div className="calendar-header">
          <button className="icon-btn" onClick={() => changeMonth(-1)} type="button" aria-label="Bulan sebelumnya">
            ‹
          </button>
          <span className="calendar-month-label">{monthLabel}</span>
          <button className="icon-btn" onClick={() => changeMonth(1)} type="button" aria-label="Bulan berikutnya">
            ›
          </button>
        </div>
        <div className="calendar-grid calendar-weekdays">
          {DAY_LABELS.map((d) => (
            <div key={d} className="calendar-weekday">
              {d}
            </div>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} className="calendar-cell empty" />;
            const key = cellKey(day);
            const items = byDate[key] || [];
            const isToday = key === todayStr;
            const isSelected = key === selectedDate;
            const hasOverdue = key < todayStr && items.some((it) => it.status === "Diproses");
            return (
              <button
                key={key}
                type="button"
                className={`calendar-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedDate(key)}
              >
                <span className="calendar-daynum">{day}</span>
                {items.length > 0 && (
                  <span className={`calendar-dot-badge ${hasOverdue ? "danger" : ""}`}>{items.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 className="card-subtitle">
          Estimasi Selesai {formatDateShort(selectedDate)}
          {selectedDate === todayStr ? " (Hari Ini)" : ""}
        </h3>
        {selectedItems.length === 0 ? (
          <EmptyState text="Tidak ada faktur dengan estimasi selesai di tanggal ini." />
        ) : (
          <ScheduleList items={selectedItems} onPrint={onPrint} />
        )}
      </div>
    </div>
  );
}

function ScheduleList({ items, onPrint }) {
  return (
    <div className="schedule-list">
      {items.map((t) => (
        <div className="schedule-item" key={t.id}>
          <div>
            <div className="cell-strong">{t.customerName}</div>
            <div className="cell-sub mono">{t.invoiceNo}</div>
          </div>
          <div className="schedule-item-mid">
            <span className={`status-pill status-${t.status.replace(/\s/g, "")}`}>{t.status}</span>
            <span className={`payment-badge payment-${(t.paymentStatus || "Lunas").replace(/\s/g, "")}`}>
              {t.paymentStatus || "Lunas"}
            </span>
          </div>
          <div className="schedule-item-right">
            <span className="mono cell-strong">{formatRupiah(t.total)}</span>
            <button className="icon-btn" onClick={() => onPrint(t)} aria-label="Cetak">
              <Printer size={14} />
            </button>
          </div>
        </div>
      ))}
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
      (t.items || []).forEach((it) => {
        if (it.calcType !== "kg") return;
        const key = (it.name || "Kiloan").replace(/^Cucian Kiloan - /, "");
        if (!map[key]) map[key] = { count: 0, total: 0 };
        map[key].count += 1;
        map[key].total += it.subtotal || 0;
      });
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
              <CartesianGrid strokeDasharray="3 3" stroke="#D6E7F5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#5C7391" }} axisLine={{ stroke: "#D6E7F5" }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#5C7391" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Math.round(v / 1000)}rb`}
              />
              <Tooltip
                formatter={(v) => formatRupiah(v)}
                contentStyle={{ borderRadius: 10, border: "1px solid #D6E7F5", fontFamily: "Inter, sans-serif", fontSize: 12 }}
              />
              <Bar dataKey="total" fill="#245C57" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {byService.length > 0 && (
        <div className="card">
          <h3 className="card-subtitle">Rincian per Jenis Kiloan</h3>
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

  const updateService = (id, patch) => {
    const next = local.services.map((s) => (s.id === id ? { ...s, ...patch } : s));
    commit({ services: next });
  };

  const addService = () => {
    commit({ services: [...local.services, { id: uid("svc"), name: "Layanan Baru", pricePerKg: 5000 }] });
  };

  const removeService = (id) => {
    if (local.services.length <= 1) return;
    commit({ services: local.services.filter((s) => s.id !== id) });
  };

  const removeItemPrice = (id) => {
    commit({ itemPrices: local.itemPrices.filter((it) => it.id !== id) });
  };

  const toggleField = (key) => {
    commit({ receiptFields: { ...local.receiptFields, [key]: !local.receiptFields[key] } });
  };

  const FIELD_TOGGLES = [
    { key: "showAddress", label: "Alamat Usaha" },
    { key: "showPhone", label: "No. HP Usaha" },
    { key: "showHours", label: "Jam Operasional" },
    { key: "showCustomerPhone", label: "No. HP Pelanggan" },
    { key: "showEstCompletion", label: "Estimasi Selesai/Ambil" },
    { key: "showItemDetail", label: "Rincian Berat/Qty per Item" },
    { key: "showNotes", label: "Catatan Transaksi" },
    { key: "showStamp", label: "Stempel Status Pembayaran" },
    { key: "showFooterNote", label: "Catatan Kaki Faktur" },
    { key: "showPhoto", label: "Foto Lampiran (Timbangan/Bukti)" },
  ];

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

      <div className="items-section">
        <div className="items-header">
          <span>Jenis Layanan &amp; Harga per Kg</span>
          <button className="btn-ghost" onClick={addService} type="button">
            <Plus size={15} /> Tambah Layanan
          </button>
        </div>
        {local.services.map((s) => (
          <div className="price-row" key={s.id}>
            <input className="input" value={s.name} onChange={(e) => updateService(s.id, { name: e.target.value })} />
            <input
              className="input"
              type="number"
              value={s.pricePerKg}
              onChange={(e) => updateService(s.id, { pricePerKg: Number(e.target.value) || 0 })}
            />
            <button
              className="icon-btn danger"
              onClick={() => removeService(s.id)}
              type="button"
              disabled={local.services.length <= 1}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <p className="hint-text">Minimal harus ada 1 jenis layanan.</p>
      </div>

      <Field label="Minimal Berat untuk Gratis Antar-Jemput (kg)">
        <input
          className="input"
          type="number"
          value={local.freeDeliveryMinKg ?? 0}
          onChange={(e) => commit({ freeDeliveryMinKg: Number(e.target.value) || 0 })}
        />
      </Field>

      <label className="field-toggle rounding-toggle">
        <input
          type="checkbox"
          checked={local.roundingEnabled !== false}
          onChange={() => commit({ roundingEnabled: local.roundingEnabled === false })}
        />
        <span>
          Bulatkan total ke Rp 1.000 terdekat (mis. Rp 28.300 → Rp 28.000, Rp 28.700 → Rp 29.000) — biar gampang
          cari kembalian tunai
        </span>
      </label>

      <Field label="Ukuran Tampilan Aplikasi">
        <select
          className="input"
          value={local.fontScale || 1}
          onChange={(e) => commit({ fontScale: Number(e.target.value) })}
        >
          <option value={1}>Normal</option>
          <option value={1.15}>Besar</option>
          <option value={1.3}>Lebih Besar</option>
          <option value={1.5}>Sangat Besar</option>
        </select>
        <p className="hint-text" style={{ marginTop: 6 }}>
          Semua tulisan, tombol, dan ikon di aplikasi ikut membesar. Cocok kalau susah dibaca.
        </p>
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

      <div className="settings-divider" />

      <h2 className="card-title">Pengaturan Cetak Faktur</h2>
      <p className="hint-text">Atur ukuran kertas dan bagian mana yang ikut dicetak di faktur.</p>

      <Field label="Ukuran Faktur">
        <select
          className="input"
          value={local.printSize || "80mm"}
          onChange={(e) => commit({ printSize: e.target.value })}
        >
          {PRINT_SIZES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="items-section">
        <div className="items-header">
          <span>Tampilkan di Faktur</span>
        </div>
        <div className="field-toggle-grid">
          {FIELD_TOGGLES.map((f) => (
            <label className="field-toggle" key={f.key}>
              <input
                type="checkbox"
                checked={!!local.receiptFields?.[f.key]}
                onChange={() => toggleField(f.key)}
              />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= PRINT PREVIEW MODAL ================= */

function PrintPreviewModal({ txn, settings, onClose }) {
  const size = settings.printSize || "80mm";
  const captureRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  const handleWhatsapp = () => {
    openWhatsapp(buildWhatsappLink(txn, settings));
  };

  const handlePrint = async () => {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {
        /* abaikan kalau tidak didukung */
      }
    }
    window.print();
  };

  const handleShareJpg = async () => {
    if (!captureRef.current) return;
    setSharing(true);
    setShareMsg("");
    try {
      // Menunggu font kustom (Fraunces dkk) benar-benar selesai dimuat dulu.
      // Kalau screenshot diambil sebelum font siap, lebar tiap kata salah dihitung
      // dan hasilnya jadi renggang/berantakan spasinya.
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (e) {
          /* abaikan kalau tidak didukung */
        }
      }

      const node = captureRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        width: node.scrollWidth,
        height: node.scrollHeight,
        windowWidth: node.scrollWidth,
        windowHeight: node.scrollHeight,
      });

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            setSharing(false);
            setShareMsg("Gagal membuat gambar faktur, coba lagi.");
            return;
          }
          const file = new File([blob], `${txn.invoiceNo}.jpg`, { type: "image/jpeg" });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              // Sengaja TIDAK menyertakan "text" - beberapa HP Android menolak share yang
              // berisi file + teks sekaligus dengan pesan "Tidak dapat mengirim pesan kosong".
              await navigator.share({ files: [file] });
            } catch (e) {
              /* dibatalkan pengguna, tidak masalah */
            }
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${txn.invoiceNo}.jpg`;
            a.click();
            URL.revokeObjectURL(url);
            setShareMsg("Faktur JPG ter-download (share langsung tidak didukung di perangkat ini).");
          }
          setSharing(false);
        },
        "image/jpeg",
        0.92
      );
    } catch (e) {
      setSharing(false);
      setShareMsg("Gagal membuat gambar faktur, coba lagi.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box size-${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Faktur Tersimpan</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <ReceiptPreview txn={txn} settings={settings} />
        </div>
        {shareMsg && <div className="share-msg">{shareMsg}</div>}
        <div className="modal-footer modal-footer-grid">
          <button className="btn-secondary" onClick={onClose}>
            Tutup
          </button>
          <button className="btn-whatsapp" onClick={handleWhatsapp} disabled={!txn.phone} type="button">
            <MessageCircle size={16} /> WhatsApp
          </button>
          <button className="btn-secondary" onClick={handleShareJpg} disabled={sharing} type="button">
            <Share2 size={16} /> {sharing ? "Memproses..." : "Bagikan JPG"}
          </button>
          <button className="btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Cetak Faktur
          </button>
        </div>
      </div>

      {/* Salinan tersembunyi (di luar area scroll) khusus untuk generate gambar,
          supaya hasilnya selalu utuh, tidak terpotong tinggi layar. */}
      <div className="capture-offscreen" ref={captureRef} onClick={(e) => e.stopPropagation()}>
        <ReceiptPreview txn={txn} settings={settings} />
      </div>
    </div>
  );
}

function ReceiptPreview({ txn, settings }) {
  const f = settings.receiptFields || defaultSettings.receiptFields;
  const size = settings.printSize || "80mm";
  const isThermal = size === "58mm" || size === "80mm";
  const paymentStatus = txn.paymentStatus || "Lunas";
  const isPaid = paymentStatus === "Lunas";
  const photos = txn.photos && txn.photos.length > 0 ? txn.photos : txn.photo ? [txn.photo] : [];

  return (
    <div className={`receipt size-${size} ${isThermal ? "thermal" : "sheet"}`}>
      {isThermal && (
        <div className="receipt-notch-row">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="notch" />
          ))}
        </div>
      )}
      <div className="receipt-body">
        <div className="receipt-brand">
          <Shirt size={20} />
          <div>
            <div className="receipt-brand-name">{settings.businessName}</div>
            {f.showAddress && <div className="receipt-brand-sub">{settings.address}</div>}
            {(f.showPhone || f.showHours) && (
              <div className="receipt-brand-sub">
                {f.showPhone ? settings.phone : ""}
                {f.showHours && settings.hours ? ` • ${settings.hours}` : ""}
              </div>
            )}
          </div>
        </div>

        <div className="receipt-divider" />

        <div className="receipt-meta">
          <div>
            <span>No. Faktur</span>
            <strong className="mono">{txn.invoiceNo}</strong>
          </div>
          <div>
            <span>Tanggal Masuk</span>
            <strong>{formatDateShort(txn.dateIn)}</strong>
          </div>
          <div>
            <span>Pelanggan</span>
            <strong>{txn.customerName}</strong>
          </div>
          {f.showCustomerPhone && txn.phone && (
            <div>
              <span>No. HP</span>
              <strong>{txn.phone}</strong>
            </div>
          )}
          {f.showEstCompletion && txn.dateEst && (
            <div>
              <span>Estimasi Selesai</span>
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
                  {f.showItemDetail && (
                    <div className="receipt-item-sub">
                      {it.calcType === "kg" ? `${it.weight} kg x ${formatRupiah(it.price)}` : `${it.qty} x ${formatRupiah(it.price)}`}
                    </div>
                  )}
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

        {!!txn.roundingAmount && (
          <div className="receipt-rounding-rows">
            <div className="receipt-total-row receipt-subtotal-row">
              <span>Subtotal</span>
              <span className="mono">{formatRupiah(txn.subtotalAmount)}</span>
            </div>
            <div className="receipt-total-row receipt-subtotal-row">
              <span>Pembulatan</span>
              <span className="mono">
                {txn.roundingAmount > 0 ? "+" : "-"}
                {formatRupiah(Math.abs(txn.roundingAmount))}
              </span>
            </div>
          </div>
        )}

        <div className="receipt-total-row">
          <span>TOTAL</span>
          <strong className="mono">{formatRupiah(txn.total)}</strong>
        </div>

        {f.showNotes && txn.notes && <div className="receipt-notes">Catatan: {txn.notes}</div>}

        {f.showStamp && (
          <div className={`receipt-stamp ${isPaid ? "stamp-paid" : "stamp-unpaid"}`}>
            {paymentStatus.toUpperCase()}
          </div>
        )}

        {f.showFooterNote && <div className="receipt-footer">{settings.footerNote}</div>}

        <div className="receipt-tracking">
          Lacak status pesanan Anda di abilaundrykemanggisan.my.id/lacak
          <br />
          No. Faktur: {txn.invoiceNo}
        </div>
      </div>
      {isThermal && (
        <div className="receipt-notch-row">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="notch" />
          ))}
        </div>
      )}

      {f.showPhoto && photos.length > 0 && (
        <div className="receipt-attachment">
          <div className="receipt-attachment-header">
            Lampiran Foto Timbangan / Bukti {photos.length > 1 ? `(${photos.length})` : ""}
          </div>
          <div className="receipt-attachment-sub">
            {txn.invoiceNo} • {txn.customerName}
          </div>
          <div className="receipt-attachment-grid">
            {photos.map((p, i) => (
              <img key={i} src={p} alt={`Foto bukti ${i + 1}`} className="receipt-attachment-img" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PRINT_PAGE_SIZE = {
  "58mm": "58mm auto",
  "80mm": "80mm auto",
  a5: "A5",
  a4: "A4",
};

function InvoicePrintArea({ txn, settings }) {
  const size = settings.printSize || "80mm";
  const margin = size === "58mm" || size === "80mm" ? "0" : "10mm";
  return (
    <div id="print-area">
      <style>{`@page { size: ${PRINT_PAGE_SIZE[size] || "80mm auto"}; margin: ${margin}; }`}</style>
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
        --bg: #EAF4FB;
        --card: #FFFFFF;
        --ink: #16233D;
        --ink-soft: #5C7391;
        --line: #D6E7F5;
        --primary: #1B3B8C;
        --primary-dark: #0F235E;
        --aqua: #7EC8EA;
        --gold: #2E7BC4;
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
        .modal-overlay { display: none !important; }
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

      .header-right { display: flex; align-items: center; gap: 10px; }
      .logout-btn {
        display: flex; align-items: center; gap: 6px;
        background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25);
        color: #fff; font-size: 12.5px; font-weight: 600; padding: 7px 13px;
        border-radius: 999px; cursor: pointer;
      }
      .logout-btn:hover { background: rgba(255,255,255,0.22); }

      .login-wrap {
        min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;
      }
      .login-card {
        background: var(--card); border: 1px solid var(--line); border-radius: 20px;
        padding: 36px 32px; max-width: 380px; width: 100%;
        display: flex; flex-direction: column; gap: 14px;
        box-shadow: 0 12px 40px rgba(15,35,94,0.12);
      }
      .login-icon {
        width: 46px; height: 46px; border-radius: 14px; background: var(--primary); color: #fff;
        display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
      }
      .login-title { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; margin: 0; }
      .login-sub { font-size: 13px; color: var(--ink-soft); margin: -6px 0 6px; }

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
      .tab-btn:hover { background: #E5F0FA; color: var(--ink); }
      .tab-btn.active { background: var(--primary); color: #fff; }
      .tab-badge {
        background: var(--danger); color: #fff; font-size: 10.5px; font-weight: 700;
        border-radius: 999px; padding: 1px 6px; margin-left: 2px;
      }

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
        background: #F6FBFE;
        width: 100%;
        outline: none;
        transition: border-color 0.15s ease;
      }
      .input:focus { border-color: var(--primary); background: #fff; }
      .input:disabled { background: var(--line); color: var(--ink-soft); cursor: not-allowed; }

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

      .free-delivery-note {
        font-size: 12px; color: var(--ink-soft); background: #F0F8FC; border: 1px dashed var(--aqua);
        border-radius: 8px; padding: 8px 12px; margin-top: 4px;
      }
      .free-delivery-note.eligible { color: #1F6B45; background: #E4F5EC; border-color: #9FD8B8; }

      .item-row {
        display: flex; align-items: flex-end; gap: 10px;
        padding: 12px; background: #F0F8FC; border-radius: 12px;
        margin-bottom: 8px; flex-wrap: wrap;
      }
      .item-row-type { flex-shrink: 0; }
      .pill-toggle { display: flex; background: #DCEBF7; border-radius: 8px; padding: 2px; }
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
        border: none; background: #E5F0FA; color: var(--ink-soft);
        width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .icon-btn:hover { background: #D6E7F5; }
      .icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      .icon-btn.danger { color: var(--danger); background: var(--danger-bg); }
      .icon-btn.danger:hover { background: #F0D9D2; }

      .rounding-summary {
        background: #F0F8FC; border: 1px solid #D6E7F5; border-radius: 10px; padding: 10px 16px;
        margin: 12px 0 4px; display: flex; flex-direction: column; gap: 4px;
      }
      .rounding-row { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--ink-soft); }
      .rounding-row .mono { color: var(--ink); font-weight: 600; }

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
        background: var(--gold); color: #FFFFFF; border: none;
        padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 700;
        cursor: pointer; transition: filter 0.15s ease;
      }
      .btn-primary:hover { filter: brightness(0.95); }
      .btn-full { width: 100%; }
      .btn-secondary {
        background: #E5F0FA; color: var(--ink); border: none;
        padding: 12px 18px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;
      }

      .history-toolbar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
      .search-box {
        flex: 1; min-width: 200px; display: flex; align-items: center; gap: 8px;
        border: 1px solid var(--line); border-radius: 9px; padding: 9px 12px; background: #F6FBFE;
      }
      .search-box input { border: none; outline: none; background: transparent; font-size: 13.5px; width: 100%; color: var(--ink); }
      .status-filter { max-width: 170px; }

      .table-wrap { overflow-x: auto; }
      .txn-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .txn-table th {
        text-align: left; padding: 10px 8px; font-size: 11.5px; text-transform: uppercase;
        letter-spacing: 0.4px; color: var(--ink-soft); border-bottom: 1px solid var(--line);
      }
      .txn-table td { padding: 11px 8px; border-bottom: 1px solid #E5F0FA; vertical-align: middle; }
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
        border-bottom: 1px solid #E5F0FA; font-size: 13px;
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
        background: #E1EFF9; border-radius: 18px; max-width: 400px; width: 100%;
        max-height: 88vh; display: flex; flex-direction: column; overflow: hidden;
      }
      .modal-box.size-a5 { max-width: 620px; }
      .modal-box.size-a4 { max-width: 760px; }
      .modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px; border-bottom: 1px solid var(--line);
      }
      .modal-header h3 { margin: 0; font-family: 'Fraunces', serif; font-size: 16px; }
      .modal-body { padding: 16px; overflow-y: auto; overflow-x: auto; display: flex; justify-content: center; }
      .modal-footer { display: flex; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--line); }
      .modal-footer .btn-primary, .modal-footer .btn-secondary, .modal-footer .btn-whatsapp { flex: 1; }
      .modal-footer-grid { flex-wrap: wrap; }
      .modal-footer-grid > button { min-width: calc(50% - 5px); flex: 1 1 calc(50% - 5px); }
      .btn-whatsapp {
        display: flex; align-items: center; justify-content: center; gap: 7px;
        background: #25D366; color: #fff; border: none;
        padding: 12px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 700; cursor: pointer;
      }
      .btn-whatsapp:hover { filter: brightness(0.95); }
      .btn-whatsapp:disabled { opacity: 0.45; cursor: not-allowed; }
      .icon-btn.whatsapp { color: #128C4A; }
      .icon-btn.whatsapp:hover { background: #DCF5E5; }
      .icon-btn.whatsapp:disabled { opacity: 0.35; cursor: not-allowed; }
      .capture-offscreen {
        position: fixed; top: 0; left: -9999px; z-index: -1; pointer-events: none;
      }
      .share-msg {
        font-size: 12px; color: var(--ink-soft); text-align: center; padding: 8px 18px 0;
      }

      /* Receipt / faktur styling */
      .receipt {
        background: #fff; border-radius: 6px; overflow: hidden;
        font-family: 'IBM Plex Mono', monospace; color: #182642;
        box-shadow: 0 2px 14px rgba(0,0,0,0.08);
      }
      .receipt-notch-row { display: flex; justify-content: space-between; padding: 0 6px; background: #E1EFF9; }
      .notch { width: 8px; height: 8px; border-radius: 50%; background: #E1EFF9; box-shadow: 0 0 0 4px #fff inset; margin-top: -4px; }
      .receipt-body { padding: 16px 20px 18px; }
      .receipt-brand { display: flex; align-items: flex-start; gap: 10px; color: var(--primary-dark); }
      .receipt-brand-name { font-family: 'Fraunces', serif; font-weight: 700; font-size: 16px; }
      .receipt-brand-sub { font-size: 10.5px; color: #6E85A0; }
      .receipt-divider { border-top: 1px dashed #B9D3E8; margin: 8px 0; }
      .receipt-meta { display: flex; flex-direction: column; gap: 2px; font-size: 11.5px; }
      .receipt-meta > div { display: flex; justify-content: space-between; gap: 10px; }
      .receipt-meta span { color: #6E85A0; }
      .receipt-items { width: 100%; border-collapse: collapse; font-size: 11.5px; }
      .receipt-items td { padding: 4px 0; vertical-align: top; }
      .receipt-item-sub { font-size: 10px; color: #7C93AC; margin-top: 1px; }
      .right { text-align: right; }
      .receipt-total-row { display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; font-weight: 700; }
      .receipt-total-row strong { font-size: 17px; color: var(--primary-dark); }
      .receipt-subtotal-row { font-size: 11px; font-weight: 500; color: #7A7568; margin-bottom: 3px; }
      .receipt-rounding-rows { margin-bottom: 4px; }
      .receipt-notes { font-size: 10.5px; color: #6E85A0; margin-top: 8px; font-style: italic; }
      .receipt-stamp {
        display: inline-block; margin: 10px auto 4px; border: 2.5px solid var(--gold); color: var(--gold);
        font-weight: 700; font-size: 13px; padding: 4px 14px; border-radius: 6px; transform: rotate(-6deg);
        letter-spacing: 1.5px;
      }
      .receipt-footer { text-align: center; font-size: 10.5px; color: #7C93AC; margin-top: 6px; }
      .receipt-tracking {
        text-align: center; font-size: 9.5px; color: var(--primary); margin-top: 8px; line-height: 1.5;
        border-top: 1px dashed #B9D3E8; padding-top: 8px; font-weight: 600;
      }
      .receipt.sheet .receipt-tracking { font-size: 11px; }

      /* Lampiran foto (halaman terpisah untuk A4/A5) */
      .receipt-attachment { padding: 16px 20px 20px; border-top: 1px dashed #B9D3E8; }
      .receipt.sheet .receipt-attachment {
        page-break-before: always; border-top: none; padding: 34px 40px;
      }
      .receipt-attachment-header {
        font-family: 'Fraunces', serif; font-weight: 700; font-size: 14px; color: #0F235E; margin-bottom: 2px;
      }
      .receipt.sheet .receipt-attachment-header { font-size: 19px; }
      .receipt-attachment-sub { font-size: 10.5px; color: #6E85A0; margin-bottom: 12px; }
      .receipt-attachment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .receipt.thermal .receipt-attachment-grid { grid-template-columns: 1fr; }
      .receipt-attachment-img {
        width: 100%; max-width: 100%; border-radius: 8px; border: 1px solid #D6E7F5; display: block;
        page-break-inside: avoid; object-fit: cover;
      }

      /* Form upload foto di transaksi baru */
      .photo-grid { display: flex; flex-wrap: wrap; gap: 10px; }
      .photo-upload-btn {
        display: inline-flex; align-items: center; gap: 8px; background: #F0F8FC; border: 1px dashed var(--aqua);
        color: var(--primary); font-size: 13px; font-weight: 600; padding: 10px 16px; border-radius: 10px;
        cursor: pointer; width: fit-content;
      }
      .photo-upload-btn:hover { background: #E5F0FA; }
      .photo-upload-tile {
        flex-direction: column; justify-content: center; width: 96px; height: 96px; padding: 8px;
        text-align: center; gap: 4px; font-size: 11px;
      }
      .photo-preview { position: relative; width: 96px; height: 96px; flex-shrink: 0; }
      .photo-preview img {
        width: 96px; height: 96px; border-radius: 10px; border: 1px solid var(--line); display: block;
        object-fit: cover;
      }
      .photo-remove {
        position: absolute; top: -8px; right: -8px; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        width: 26px; height: 26px;
      }
      .photo-count-hint { display: block; font-size: 11.5px; color: var(--ink-soft); margin-top: 6px; }

      @media print {
        body { margin: 0; }
        .receipt { box-shadow: none; margin: 0 auto; }
      }

      /* Ukuran faktur */
      .receipt.size-58mm { width: 58mm; font-size: 9px; }
      .receipt.size-58mm .receipt-brand-name { font-size: 12px; }
      .receipt.size-58mm .receipt-total-row strong { font-size: 14px; }
      .receipt.size-80mm { width: 80mm; font-size: 10.5px; }
      .receipt.size-a5 { width: 148mm; font-size: 13px; }
      .receipt.size-a5 .receipt-brand-name { font-size: 19px; }
      .receipt.size-a5 .receipt-total-row strong { font-size: 20px; }
      .receipt.size-a4 { width: 190mm; font-size: 14px; }
      .receipt.size-a4 .receipt-brand-name { font-size: 21px; }
      .receipt.size-a4 .receipt-total-row strong { font-size: 22px; }

      .receipt.sheet { font-family: 'Inter', sans-serif; border-radius: 12px; }
      .receipt.sheet .receipt-body { padding: 34px 40px 40px; }
      .receipt.sheet .receipt-items td { padding: 9px 0; }
      .receipt.sheet .receipt-item-sub { font-size: 11.5px; }
      .receipt.sheet .receipt-stamp { font-size: 14px; padding: 6px 18px; }
      .modal-body { overflow-x: auto; }

      /* Status pembayaran */
      .pill-toggle.wide { width: 100%; }
      .pill-toggle.wide .pill { flex: 1; text-align: center; }
      .payment-pill {
        border: none; border-radius: 999px; padding: 5px 10px; font-size: 11.5px; font-weight: 600;
        cursor: pointer; outline: none;
      }
      .payment-BelumBayar { background: var(--danger-bg); color: var(--danger); }
      .payment-KurangBayar { background: #FBEBD4; color: #8A5A16; }
      .payment-Lunas { background: #DCEEE5; color: #1F6B45; }
      .payment-badge {
        font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; flex-shrink: 0;
      }
      .payment-badge.payment-BelumBayar { background: var(--danger-bg); color: var(--danger); }
      .payment-badge.payment-KurangBayar { background: #FBEBD4; color: #8A5A16; }
      .payment-badge.payment-Lunas { background: #DCEEE5; color: #1F6B45; }
      .receipt-stamp.stamp-unpaid { border-color: var(--danger); color: var(--danger); }

      .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

      /* Pengaturan cetak faktur */
      .settings-divider { border-top: 1px solid var(--line); margin: 22px 0 18px; }
      .field-toggle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
      @media (max-width: 640px) { .field-toggle-grid { grid-template-columns: 1fr; } }
      .field-toggle {
        display: flex; align-items: center; gap: 9px; font-size: 13px; color: var(--ink);
        padding: 7px 0; cursor: pointer;
      }
      .field-toggle input { width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer; }
      .rounding-toggle { align-items: flex-start; margin: 4px 0 22px; }
      .rounding-toggle input { margin-top: 3px; flex-shrink: 0; }

      /* Dashboard Pekerjaan */
      .dashboard-stat-grid { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 900px) { .dashboard-stat-grid { grid-template-columns: 1fr 1fr; } }
      .stat-card-warning { background: #FBF3E9; border-color: #EFDBB8; }
      .stat-card-warning .stat-label { display: flex; align-items: center; gap: 5px; color: #9A6B1E; }
      .stat-card-warning .stat-value { color: #9A6B1E; }

      .kerja-board { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 4px; }
      @media (max-width: 700px) { .kerja-board { grid-template-columns: 1fr; } }
      .kerja-column {
        background: var(--card); border: 1px solid var(--line); border-radius: 14px;
        display: flex; flex-direction: column; max-height: 640px;
      }
      .kerja-column-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px 16px; border-bottom: 1px solid var(--line);
        font-weight: 600; font-size: 13.5px;
      }
      .kerja-column-count {
        background: #E5F0FA; color: var(--ink-soft); font-size: 11.5px; font-weight: 700;
        padding: 2px 9px; border-radius: 999px;
      }
      .kerja-column-body { padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
      .kerja-empty { font-size: 12px; color: var(--ink-soft); text-align: center; padding: 20px 0; margin: 0; }
      .kerja-card {
        background: #F0F8FC; border: 1px solid #D9EAF6; border-radius: 10px; padding: 10px 12px;
        display: flex; flex-direction: column; gap: 4px;
      }
      .kerja-card-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
      .kerja-card-name { font-weight: 600; font-size: 13px; }
      .kerja-card-sub { font-size: 10.5px; color: var(--ink-soft); }
      .kerja-card-bottom {
        display: flex; justify-content: space-between; font-size: 11.5px; color: var(--ink-soft); margin-top: 2px;
      }
      .kerja-card-bottom .mono { color: var(--primary-dark); font-weight: 600; }

      /* Jadwal / Kalender */
      .reminder-banners { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
      @media (max-width: 700px) { .reminder-banners { grid-template-columns: 1fr; } }
      .reminder-card {
        display: flex; align-items: center; gap: 12px; text-align: left;
        border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px;
        background: var(--card); cursor: pointer; font-family: 'Inter', sans-serif;
      }
      .reminder-card.muted { opacity: 0.55; cursor: default; }
      .reminder-count {
        font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700;
        min-width: 38px; text-align: center;
      }
      .reminder-title { font-size: 13px; font-weight: 700; }
      .reminder-sub { font-size: 11.5px; color: var(--ink-soft); }
      .reminder-overdue { border-color: #E9C6BA; }
      .reminder-overdue .reminder-count { color: var(--danger); }
      .reminder-today { border-color: var(--aqua); }
      .reminder-today .reminder-count { color: var(--primary); }
      .reminder-tomorrow .reminder-count { color: #8A5A16; }

      .calendar-card { padding-bottom: 10px; }
      .calendar-header {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
      }
      .calendar-month-label { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; }
      .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
      .calendar-weekdays { margin-bottom: 6px; }
      .calendar-weekday { text-align: center; font-size: 11px; color: var(--ink-soft); font-weight: 600; padding: 4px 0; }
      .calendar-cell {
        aspect-ratio: 1; border: 1px solid transparent; background: #F6FBFE; border-radius: 10px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        cursor: pointer; font-family: 'Inter', sans-serif; position: relative;
      }
      .calendar-cell.empty { background: transparent; cursor: default; }
      .calendar-cell:hover:not(.empty) { background: #E5F0FA; }
      .calendar-cell.today { border-color: var(--primary); font-weight: 700; }
      .calendar-cell.selected { background: var(--primary); }
      .calendar-cell.selected .calendar-daynum { color: #fff; }
      .calendar-daynum { font-size: 13px; color: var(--ink); }
      .calendar-dot-badge {
        font-size: 9.5px; font-weight: 700; background: var(--aqua); color: var(--primary-dark);
        border-radius: 999px; padding: 0 6px; line-height: 15px;
      }
      .calendar-dot-badge.danger { background: var(--danger); color: #fff; }

      .schedule-list { display: flex; flex-direction: column; gap: 8px; }
      .schedule-item {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        background: #F6FBFE; border: 1px solid #E5F0FA; border-radius: 10px; padding: 10px 14px;
        flex-wrap: wrap;
      }
      .schedule-item-mid { display: flex; gap: 6px; flex-wrap: wrap; }
      .schedule-item-right { display: flex; align-items: center; gap: 10px; }

      /* Pelanggan */
      .customer-list { display: flex; flex-direction: column; gap: 8px; }
      .customer-row {
        display: flex; align-items: center; gap: 14px; width: 100%; text-align: left;
        background: #F6FBFE; border: 1px solid #E5F0FA; border-radius: 12px; padding: 12px 16px;
        cursor: pointer; font-family: 'Inter', sans-serif;
      }
      .customer-row:hover { background: #E5F0FA; }
      .customer-rank {
        width: 26px; height: 26px; border-radius: 50%; background: var(--primary); color: #fff;
        font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .customer-info { flex: 1; min-width: 0; }
      .customer-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
      .customer-count { font-size: 11px; color: var(--ink-soft); }
      .customer-total { font-size: 14px; font-weight: 700; color: var(--primary-dark); }
      .back-btn { margin-bottom: 14px; }
      .customer-detail-stats { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 700px) { .customer-detail-stats { grid-template-columns: 1fr 1fr; } }

      /* Permintaan Jemput */
      .pickup-list { display: flex; flex-direction: column; gap: 10px; }
      .pickup-card { background: #F6FBFE; border: 1px solid #E5F0FA; border-radius: 12px; padding: 14px 16px; }
      .pickup-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
      .pickup-card-row {
        display: flex; align-items: flex-start; gap: 7px; font-size: 12.5px; color: var(--ink-soft);
        margin-bottom: 4px;
      }
      .pickup-card-row svg { flex-shrink: 0; margin-top: 2px; }
      .pickup-card-notes { font-size: 12px; color: var(--ink-soft); font-style: italic; margin-top: 4px; }
      .pickup-card-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }

      .pickup-card-top-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
      .pickup-code-badge {
        font-size: 11px; font-weight: 700; color: var(--primary-dark); background: #E5F0FA;
        padding: 2px 8px; border-radius: 999px; letter-spacing: 1px;
      }
      .pickup-status-badge {
        font-size: 10.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px; white-space: nowrap;
      }
      .pickup-status-Baru { background: #FBEBD4; color: #8A5A16; }
      .pickup-status-DijadwalkanUlang { background: #DCEBF5; color: #235E86; }
      .pickup-status-Ditolak { background: var(--danger-bg); color: var(--danger); }
      .pickup-status-Selesai { background: #DCEEE5; color: #1F6B45; }
      .pickup-card-adminnote { color: var(--primary-dark); font-style: normal; }

      .btn-ghost-danger { border-color: #E9C6BA; color: var(--danger); }
      .btn-ghost-danger:hover { background: var(--danger-bg); }
      .btn-whatsapp-danger {
        background: var(--danger); color: #fff; border: none; padding: 10px 16px; border-radius: 9px;
        font-size: 13px; font-weight: 700; cursor: pointer;
      }

      .pickup-action-form {
        margin-top: 12px; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px;
        display: flex; flex-direction: column; gap: 10px;
      }
      .pickup-action-title { font-weight: 700; font-size: 13.5px; color: var(--ink); }
      .pickup-action-btns { display: flex; gap: 10px; justify-content: flex-end; }
    `}</style>
  );
}
