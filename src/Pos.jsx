import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { storage } from "./storage";
import html2canvas from "html2canvas";
import {
  Lock,
  Shirt,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  X,
  Save,
  MessageCircle,
  LogOut,
  ArrowLeft,
  Droplets,
  Package,
  Wind,
  Zap,
  Camera,
  Printer,
  Share2,
} from "lucide-react";

const STORAGE_SETTINGS = "bersih_laundry_settings_v1";
const STORAGE_TRANSACTIONS = "bersih_laundry_transactions_v1";
const PAYMENT_STATUSES = ["Belum Bayar", "Kurang Bayar", "Lunas"];
const AUTH_EMAIL_DOMAIN = "abilaundry.local";
const MAX_PHOTOS = 10;

const defaultSettings = {
  businessName: "Abi Laundry Kemanggisan",
  address: "",
  phone: "",
  hours: "",
  services: [],
  itemPrices: [],
  roundingEnabled: true,
  printSize: "80mm",
  footerNote: "",
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

/* ================= HELPERS ================= */

function usernameToAuthEmail(username) {
  return `${username.trim().toLowerCase().replace(/\s+/g, "")}@${AUTH_EMAIL_DOMAIN}`;
}

function formatRupiah(n) {
  const num = Number(n) || 0;
  return "Rp " + num.toLocaleString("id-ID");
}

function formatDateShort(d) {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeInvoiceNo(count) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
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

// Ikon & warna tiap tile dipilih bergantian biar keliatan seperti "gambar produk" tanpa foto asli
const KG_STYLES = [
  { icon: Droplets, bg: "#1B3B8C" },
  { icon: Wind, bg: "#2E7BC4" },
  { icon: Zap, bg: "#C99A3C" },
  { icon: Droplets, bg: "#7A5AC9" },
];
const PCS_STYLES = [
  { icon: Package, bg: "#2E7BC4" },
  { icon: Shirt, bg: "#1B3B8C" },
  { icon: Package, bg: "#C99A3C" },
  { icon: Shirt, bg: "#7A5AC9" },
];

/* ================= MAIN ================= */

export default function Pos() {
  const [session, setSession] = useState(undefined);
  const [settings, setSettings] = useState(defaultSettings);
  const [txnCount, setTxnCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [cart, setCart] = useState([]);
  const [weightPrompt, setWeightPrompt] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateIn, setDateIn] = useState(todayISO());
  const [dateEst, setDateEst] = useState(addDaysISO(2));
  const [paymentStatus, setPaymentStatus] = useState("Belum Bayar");
  const [photos, setPhotos] = useState([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successTxn, setSuccessTxn] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const r = await storage.get(STORAGE_SETTINGS).catch(() => null);
        if (r && r.value) {
          const parsed = JSON.parse(r.value);
          setSettings({
            ...defaultSettings,
            ...parsed,
            receiptFields: { ...defaultSettings.receiptFields, ...(parsed.receiptFields || {}) },
          });
        }
        const r2 = await storage.get(STORAGE_TRANSACTIONS).catch(() => null);
        if (r2 && r2.value) setTxnCount(JSON.parse(r2.value).length);
      } finally {
        setLoaded(true);
      }
    })();
  }, [session]);

  const subtotal = useMemo(() => cart.reduce((s, r) => s + r.subtotal, 0), [cart]);
  const roundingEnabled = settings.roundingEnabled !== false;
  const total = roundingEnabled ? Math.round(subtotal / 1000) * 1000 : subtotal;
  const roundingAmount = total - subtotal;

  const addKgToCart = (service, weight) => {
    const w = Number(weight);
    if (!w || w <= 0) return;
    setCart((prev) => [
      ...prev,
      {
        rowId: uid("row"),
        calcType: "kg",
        serviceId: service.id,
        name: `Cucian Kiloan - ${service.name}`,
        weight: w,
        qty: 1,
        price: service.pricePerKg,
        subtotal: w * service.pricePerKg,
      },
    ]);
    setWeightPrompt(null);
  };

  const addPcsToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((r) => r.calcType === "pcs" && r.itemId === item.id);
      if (existing) {
        return prev.map((r) =>
          r.rowId === existing.rowId ? { ...r, qty: r.qty + 1, subtotal: (r.qty + 1) * r.price } : r
        );
      }
      return [
        ...prev,
        {
          rowId: uid("row"),
          calcType: "pcs",
          itemId: item.id,
          name: `Cucian Satuan - ${item.name}`,
          qty: 1,
          price: item.price,
          subtotal: item.price,
        },
      ];
    });
  };

  const decPcs = (rowId) => {
    setCart((prev) =>
      prev
        .map((r) => (r.rowId === rowId ? { ...r, qty: r.qty - 1, subtotal: (r.qty - 1) * r.price } : r))
        .filter((r) => r.calcType !== "pcs" || r.qty > 0)
    );
  };

  const removeRow = (rowId) => setCart((prev) => prev.filter((r) => r.rowId !== rowId));

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
    } finally {
      setPhotoLoading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (index) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const resetOrder = () => {
    setCart([]);
    setCustomerName("");
    setPhone("");
    setDateIn(todayISO());
    setDateEst(addDaysISO(2));
    setPaymentStatus("Belum Bayar");
    setPhotos([]);
    setError("");
    setSuccessTxn(null);
    setCartOpen(false);
  };

  const handleCheckout = async () => {
    if (!customerName.trim()) {
      setError("Nama pelanggan wajib diisi.");
      return;
    }
    if (!dateIn) {
      setError("Tanggal masuk wajib diisi.");
      return;
    }
    if (cart.length === 0) {
      setError("Keranjang masih kosong.");
      return;
    }
    setError("");
    setSaving(true);

    const kgServiceNames = Array.from(
      new Set(cart.filter((r) => r.calcType === "kg").map((r) => r.name.replace(/^Cucian Kiloan - /, "")))
    );
    const serviceSummary = kgServiceNames.length > 0 ? kgServiceNames.join(", ") : "Satuan";

    const txn = {
      id: uid("txn"),
      invoiceNo: makeInvoiceNo(txnCount),
      customerName: customerName.trim(),
      phone: phone.trim(),
      serviceType: serviceSummary,
      dateIn,
      dateEst,
      items: cart,
      additionalFee: 0,
      notes: "",
      subtotalAmount: subtotal,
      roundingAmount,
      total,
      status: "Diproses",
      paymentStatus,
      photos,
      createdAt: new Date().toISOString(),
    };

    try {
      const r = await storage.get(STORAGE_TRANSACTIONS).catch(() => null);
      const list = r && r.value ? JSON.parse(r.value) : [];
      await storage.set(STORAGE_TRANSACTIONS, JSON.stringify([txn, ...list]));
      setTxnCount(list.length + 1);
      setSuccessTxn(txn);
      setCart([]);
      setCartOpen(false);
    } catch (e) {
      setError("Gagal menyimpan transaksi, coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  if (session === undefined) return <CenterMsg text="Memeriksa sesi login..." />;
  if (!session) return <PosLogin />;
  if (!loaded) return <CenterMsg text="Memuat data..." />;

  return (
    <div className="pos-root">
      <style>{CSS}</style>

      <header className="pos-header">
        <div className="pos-header-left">
          <div className="pos-header-icon">
            <Shirt size={18} />
          </div>
          <div>
            <div className="pos-header-title">{settings.businessName}</div>
            <div className="pos-header-sub">Kasir Cepat (POS)</div>
          </div>
        </div>
        <div className="pos-header-right">
          <a href="/admin?tab=riwayat" className="pos-header-btn">
            <ArrowLeft size={14} /> Aplikasi Utama
          </a>
          <button className="pos-header-btn" onClick={() => supabase.auth.signOut()} type="button">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <div className="pos-body">
        <main className="pos-main">
          {settings.services?.length > 0 && (
            <section className="pos-section">
              <h2>Kiloan</h2>
              <div className="pos-grid">
                {settings.services.map((s, i) => {
                  const style = KG_STYLES[i % KG_STYLES.length];
                  const Icon = style.icon;
                  return (
                    <button
                      key={s.id}
                      className="pos-tile"
                      style={{ background: style.bg }}
                      onClick={() => setWeightPrompt({ service: s })}
                      type="button"
                    >
                      <Icon size={38} />
                      <span className="pos-tile-name">{s.name}</span>
                      <span className="pos-tile-price">{formatRupiah(s.pricePerKg)}/kg</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {settings.itemPrices?.length > 0 && (
            <section className="pos-section">
              <h2>Satuan</h2>
              <div className="pos-grid">
                {settings.itemPrices.map((it, i) => {
                  const style = PCS_STYLES[i % PCS_STYLES.length];
                  const Icon = style.icon;
                  const inCartRow = cart.find((r) => r.calcType === "pcs" && r.itemId === it.id);
                  return (
                    <button
                      key={it.id}
                      className="pos-tile"
                      style={{ background: style.bg }}
                      onClick={() => addPcsToCart(it)}
                      type="button"
                    >
                      {inCartRow && <span className="pos-tile-badge">{inCartRow.qty}</span>}
                      <Icon size={38} />
                      <span className="pos-tile-name">{it.name}</span>
                      <span className="pos-tile-price">{formatRupiah(it.price)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        <aside className={`pos-cart ${cartOpen ? "open" : ""}`}>
          <div className="pos-cart-header">
            <span>Keranjang ({cart.length})</span>
            <button className="pos-cart-close" onClick={() => setCartOpen(false)} type="button">
              <X size={18} />
            </button>
          </div>

          <div className="pos-cart-items">
            {cart.length === 0 && <p className="pos-cart-empty">Belum ada item, tap tile di kiri untuk mulai.</p>}
            {cart.map((r) => (
              <div className="pos-cart-item" key={r.rowId}>
                <div className="pos-cart-item-info">
                  <span className="pos-cart-item-name">{r.name}</span>
                  <span className="pos-cart-item-detail">
                    {r.calcType === "kg"
                      ? `${r.weight} kg x ${formatRupiah(r.price)}`
                      : `${r.qty} x ${formatRupiah(r.price)}`}
                  </span>
                </div>
                <div className="pos-cart-item-right">
                  <span className="pos-mono">{formatRupiah(r.subtotal)}</span>
                  {r.calcType === "pcs" ? (
                    <div className="pos-qty-btns">
                      <button onClick={() => decPcs(r.rowId)} type="button">
                        <Minus size={12} />
                      </button>
                      <button
                        onClick={() =>
                          addPcsToCart({ id: r.itemId, name: r.name.replace("Cucian Satuan - ", ""), price: r.price })
                        }
                        type="button"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  ) : (
                    <button className="pos-remove-btn" onClick={() => removeRow(r.rowId)} type="button">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pos-cart-footer">
            <label className="pos-field">
              <span>Nama Pelanggan *</span>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nama" />
            </label>
            <label className="pos-field">
              <span>No. HP</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xx-xxxx-xxxx" />
            </label>
            <div className="pos-field-grid">
              <label className="pos-field">
                <span>Tanggal Masuk *</span>
                <input type="date" value={dateIn} onChange={(e) => setDateIn(e.target.value)} />
              </label>
              <label className="pos-field">
                <span>Estimasi Selesai</span>
                <input type="date" value={dateEst} onChange={(e) => setDateEst(e.target.value)} />
              </label>
            </div>

            <div className="pos-payment-pills">
              {PAYMENT_STATUSES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={paymentStatus === p ? "active" : ""}
                  onClick={() => setPaymentStatus(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            <label className="pos-field">
              <span>Foto Timbangan / Bukti (opsional, maks {MAX_PHOTOS})</span>
              <div className="pos-photo-grid">
                {photos.map((p, i) => (
                  <div className="pos-photo-thumb" key={i}>
                    <img src={p} alt={`Bukti ${i + 1}`} />
                    <button onClick={() => removePhoto(i)} type="button">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="pos-photo-add">
                    <Camera size={16} />
                    <span>{photoLoading ? "..." : "Tambah"}</span>
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
            </label>

            {roundingEnabled && roundingAmount !== 0 && (
              <div className="pos-rounding">
                <div>
                  <span>Subtotal</span>
                  <span>{formatRupiah(subtotal)}</span>
                </div>
                <div>
                  <span>Pembulatan</span>
                  <span>
                    {roundingAmount > 0 ? "+" : "-"}
                    {formatRupiah(Math.abs(roundingAmount))}
                  </span>
                </div>
              </div>
            )}

            <div className="pos-total-row">
              <span>Total</span>
              <strong>{formatRupiah(total)}</strong>
            </div>

            {error && <div className="pos-error">{error}</div>}

            <button className="pos-checkout-btn" onClick={handleCheckout} disabled={saving} type="button">
              <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Transaksi"}
            </button>
          </div>
        </aside>
      </div>

      <button className="pos-fab" onClick={() => setCartOpen(true)} type="button">
        <ShoppingCart size={20} />
        {cart.length > 0 && <span className="pos-fab-badge">{cart.length}</span>}
      </button>

      {weightPrompt && (
        <WeightPromptModal
          service={weightPrompt.service}
          onCancel={() => setWeightPrompt(null)}
          onConfirm={(w) => addKgToCart(weightPrompt.service, w)}
        />
      )}

      {successTxn && <ReceiptModal txn={successTxn} settings={settings} onNewOrder={resetOrder} />}
    </div>
  );
}

/* ================= WEIGHT PROMPT ================= */

function WeightPromptModal({ service, onCancel, onConfirm }) {
  const [weight, setWeight] = useState("");
  return (
    <div className="pos-modal-overlay" onClick={onCancel}>
      <div className="pos-weight-box" onClick={(e) => e.stopPropagation()}>
        <h3>{service.name}</h3>
        <p>{formatRupiah(service.pricePerKg)} / kg</p>
        <input
          type="number"
          inputMode="decimal"
          autoFocus
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Berat (kg)"
        />
        <div className="pos-weight-quick">
          {[1, 2, 3, 5].map((w) => (
            <button key={w} type="button" onClick={() => setWeight(String(w))}>
              {w} kg
            </button>
          ))}
        </div>
        <div className="pos-weight-actions">
          <button className="pos-header-btn" onClick={onCancel} type="button">
            Batal
          </button>
          <button className="pos-checkout-btn" onClick={() => onConfirm(weight)} type="button">
            Tambah ke Keranjang
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= FAKTUR: PREVIEW, PRINT, SHARE ================= */

function ReceiptPreview({ txn, settings }) {
  const f = settings.receiptFields || defaultSettings.receiptFields;
  const size = settings.printSize || "80mm";
  const isThermal = size === "58mm" || size === "80mm";
  const paymentStatus = txn.paymentStatus || "Lunas";
  const isPaid = paymentStatus === "Lunas";
  const photos = txn.photos && txn.photos.length > 0 ? txn.photos : [];

  return (
    <div className={`pos-receipt size-${size} ${isThermal ? "thermal" : "sheet"}`}>
      {isThermal && (
        <div className="pos-receipt-notch">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>
      )}
      <div className="pos-receipt-body">
        <div className="pos-receipt-brand">
          <Shirt size={20} />
          <div>
            <div className="pos-receipt-brand-name">{settings.businessName}</div>
            {f.showAddress && settings.address && <div className="pos-receipt-brand-sub">{settings.address}</div>}
            {(f.showPhone || f.showHours) && (
              <div className="pos-receipt-brand-sub">
                {f.showPhone ? settings.phone : ""}
                {f.showHours && settings.hours ? ` • ${settings.hours}` : ""}
              </div>
            )}
          </div>
        </div>

        <div className="pos-receipt-divider" />

        <div className="pos-receipt-meta">
          <div>
            <span>No. Faktur</span>
            <strong className="pos-mono">{txn.invoiceNo}</strong>
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

        <div className="pos-receipt-divider" />

        <table className="pos-receipt-items">
          <tbody>
            {txn.items.map((it) => (
              <tr key={it.rowId}>
                <td>
                  {it.name}
                  {f.showItemDetail && (
                    <div className="pos-receipt-item-sub">
                      {it.calcType === "kg"
                        ? `${it.weight} kg x ${formatRupiah(it.price)}`
                        : `${it.qty} x ${formatRupiah(it.price)}`}
                    </div>
                  )}
                </td>
                <td className="pos-mono pos-right">{formatRupiah(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pos-receipt-divider" />

        {!!txn.roundingAmount && (
          <div className="pos-receipt-rounding">
            <div className="pos-receipt-total-row pos-sub">
              <span>Subtotal</span>
              <span className="pos-mono">{formatRupiah(txn.subtotalAmount)}</span>
            </div>
            <div className="pos-receipt-total-row pos-sub">
              <span>Pembulatan</span>
              <span className="pos-mono">
                {txn.roundingAmount > 0 ? "+" : "-"}
                {formatRupiah(Math.abs(txn.roundingAmount))}
              </span>
            </div>
          </div>
        )}

        <div className="pos-receipt-total-row">
          <span>TOTAL</span>
          <strong className="pos-mono">{formatRupiah(txn.total)}</strong>
        </div>

        {f.showStamp && (
          <div className={`pos-receipt-stamp ${isPaid ? "paid" : "unpaid"}`}>{paymentStatus.toUpperCase()}</div>
        )}

        {f.showFooterNote && settings.footerNote && <div className="pos-receipt-footer">{settings.footerNote}</div>}

        <div className="pos-receipt-tracking">
          Lacak status pesanan Anda di abilaundrykemanggisan.my.id/lacak
          <br />
          No. Faktur: {txn.invoiceNo}
        </div>
      </div>
      {isThermal && (
        <div className="pos-receipt-notch">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>
      )}

      {f.showPhoto && photos.length > 0 && (
        <div className="pos-receipt-attachment">
          <div className="pos-receipt-attachment-header">
            Lampiran Foto Timbangan / Bukti {photos.length > 1 ? `(${photos.length})` : ""}
          </div>
          <div className="pos-receipt-attachment-sub">
            {txn.invoiceNo} • {txn.customerName}
          </div>
          <div className="pos-receipt-attachment-grid">
            {photos.map((p, i) => (
              <img key={i} src={p} alt={`Bukti ${i + 1}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PRINT_PAGE_SIZE = { "58mm": "58mm auto", "80mm": "80mm auto", a5: "A5", a4: "A4" };

function InvoicePrintArea({ txn, settings }) {
  const size = settings.printSize || "80mm";
  const margin = size === "58mm" || size === "80mm" ? "0" : "10mm";
  return (
    <div id="pos-print-area">
      <style>{`@page { size: ${PRINT_PAGE_SIZE[size] || "80mm auto"}; margin: ${margin}; }`}</style>
      <ReceiptPreview txn={txn} settings={settings} />
    </div>
  );
}

function ReceiptModal({ txn, settings, onNewOrder }) {
  const captureRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  const waitForFonts = async () => {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {
        /* abaikan */
      }
    }
  };

  const handleWhatsapp = () => {
    window.location.href = buildWhatsappLink(txn, settings);
  };

  const handlePrint = async () => {
    await waitForFonts();
    window.print();
  };

  const handleShareJpg = async () => {
    if (!captureRef.current) return;
    setSharing(true);
    setShareMsg("");
    try {
      await waitForFonts();
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
              await navigator.share({ files: [file] });
            } catch (e) {
              /* dibatalkan pengguna */
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
    <div className="pos-modal-overlay">
      <div className="pos-receipt-modal">
        <div className="pos-receipt-modal-header">
          <h3>Transaksi Tersimpan</h3>
        </div>
        <div className="pos-receipt-modal-body">
          <ReceiptPreview txn={txn} settings={settings} />
        </div>
        {shareMsg && <div className="pos-share-msg">{shareMsg}</div>}
        <div className="pos-receipt-modal-footer">
          <button className="pos-header-btn" onClick={onNewOrder} type="button">
            Transaksi Baru
          </button>
          <button className="pos-wa-btn" onClick={handleWhatsapp} disabled={!txn.phone} type="button">
            <MessageCircle size={15} /> WhatsApp
          </button>
          <button className="pos-header-btn" onClick={handleShareJpg} disabled={sharing} type="button">
            <Share2 size={15} /> {sharing ? "..." : "Bagikan JPG"}
          </button>
          <button className="pos-checkout-btn" onClick={handlePrint} type="button">
            <Printer size={15} /> Cetak
          </button>
        </div>
      </div>

      <div className="pos-capture-offscreen" ref={captureRef}>
        <ReceiptPreview txn={txn} settings={settings} />
      </div>
      <InvoicePrintArea txn={txn} settings={settings} />
    </div>
  );
}

/* ================= LOGIN ================= */

function PosLogin() {
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
    if (authError) setError("Username atau password salah.");
  };

  return (
    <div className="pos-root">
      <style>{CSS}</style>
      <div className="pos-login-wrap">
        <form className="pos-login-card" onSubmit={handleLogin}>
          <div className="pos-login-icon">
            <Lock size={20} />
          </div>
          <h1>Kasir (POS)</h1>
          <p>Masuk untuk mulai transaksi.</p>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          {error && <div className="pos-error">{error}</div>}
          <button className="pos-checkout-btn" type="submit" disabled={loading}>
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CenterMsg({ text }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
        color: "#5b6b68",
      }}
    >
      {text}
    </div>
  );
}

/* ================= CSS ================= */

const CSS = `
  .pos-root { background: #EAF4FB; min-height: 100vh; font-family: 'Inter', sans-serif; color: #16233D; }
  .pos-header {
    background: #1B3B8C; color: #fff; padding: 12px 18px; display: flex; align-items: center;
    justify-content: space-between; position: sticky; top: 0; z-index: 20;
  }
  .pos-header-left { display: flex; align-items: center; gap: 10px; }
  .pos-header-icon { width: 34px; height: 34px; border-radius: 9px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; }
  .pos-header-title { font-weight: 700; font-size: 14px; }
  .pos-header-sub { font-size: 11px; color: rgba(255,255,255,0.75); }
  .pos-header-right { display: flex; gap: 8px; }
  .pos-header-btn {
    display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); color: #fff;
    border: none; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none;
    cursor: pointer;
  }

  .pos-body { display: flex; max-width: 1400px; margin: 0 auto; }
  .pos-main { flex: 1; padding: 20px; min-width: 0; }
  .pos-section { margin-bottom: 24px; }
  .pos-section h2 { font-family: Georgia, serif; font-size: 16px; margin: 0 0 12px; }
  .pos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 18px; }
  .pos-tile {
    position: relative; border: none; border-radius: 18px; padding: 30px 16px; color: #fff; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
    box-shadow: 0 4px 10px rgba(15,35,94,0.15); min-height: 150px; justify-content: center;
  }
  .pos-tile:active { transform: scale(0.96); }
  .pos-tile-name { font-size: 15px; font-weight: 700; line-height: 1.3; }
  .pos-tile-price { font-size: 13px; opacity: 0.85; }
  .pos-tile-badge {
    position: absolute; top: -6px; right: -6px; background: #E8935C; color: #fff; font-size: 11px;
    font-weight: 700; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center;
    justify-content: center; border: 2px solid #EAF4FB;
  }

  .pos-cart {
    width: 440px; background: #fff; border-left: 1px solid #D6E7F5; display: flex; flex-direction: column;
    position: sticky; top: 57px; height: calc(100vh - 57px); flex-shrink: 0;
  }
  .pos-cart-header { display: none; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #D6E7F5; font-weight: 700; }
  .pos-cart-close { background: none; border: none; cursor: pointer; color: #16233D; }
  .pos-cart-items { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .pos-cart-empty { font-size: 12.5px; color: #5C7391; text-align: center; margin-top: 30px; }
  .pos-cart-item { display: flex; justify-content: space-between; align-items: center; gap: 8px; background: #F6FBFE; border-radius: 10px; padding: 9px 12px; }
  .pos-cart-item-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .pos-cart-item-name { font-size: 12.5px; font-weight: 700; }
  .pos-cart-item-detail { font-size: 11px; color: #5C7391; }
  .pos-cart-item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .pos-mono { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; }
  .pos-qty-btns { display: flex; gap: 4px; }
  .pos-qty-btns button {
    width: 20px; height: 20px; border-radius: 5px; border: 1px solid #D6E7F5; background: #fff;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .pos-remove-btn { background: #F7E9E5; color: #B4553F; border: none; width: 24px; height: 24px; border-radius: 6px; cursor: pointer; }

  .pos-cart-footer { border-top: 1px solid #D6E7F5; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .pos-field { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; font-weight: 600; color: #33415C; }
  .pos-field input { border: 1px solid #D6E7F5; border-radius: 8px; padding: 8px 10px; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; }
  .pos-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pos-payment-pills { display: flex; background: #EAF4FB; border-radius: 999px; padding: 3px; gap: 3px; }
  .pos-payment-pills button {
    flex: 1; border: none; background: none; padding: 7px 4px; border-radius: 999px; font-size: 10.5px;
    font-weight: 700; color: #5C7391; cursor: pointer;
  }
  .pos-payment-pills button.active { background: #1B3B8C; color: #fff; }
  .pos-rounding { font-size: 11.5px; color: #5C7391; }
  .pos-rounding div { display: flex; justify-content: space-between; padding: 2px 0; }
  .pos-total-row { display: flex; justify-content: space-between; align-items: center; background: #1B3B8C; color: #fff; padding: 10px 14px; border-radius: 10px; }
  .pos-total-row strong { font-family: 'IBM Plex Mono', monospace; font-size: 17px; }
  .pos-error { background: #F7E9E5; color: #B4553F; font-size: 12px; padding: 8px 10px; border-radius: 8px; }
  .pos-checkout-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px; background: #2E7BC4; color: #fff;
    border: none; padding: 12px; border-radius: 10px; font-size: 13.5px; font-weight: 700; cursor: pointer;
  }
  .pos-checkout-btn:disabled { opacity: 0.5; }
  .pos-wa-btn {
    display: flex; align-items: center; justify-content: center; gap: 6px; background: #25D366; color: #fff;
    border: none; padding: 10px 14px; border-radius: 10px; font-size: 12.5px; font-weight: 700; cursor: pointer;
  }
  .pos-wa-btn:disabled { opacity: 0.5; }

  .pos-photo-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .pos-photo-thumb { position: relative; width: 56px; height: 56px; }
  .pos-photo-thumb img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; border: 1px solid #D6E7F5; }
  .pos-photo-thumb button {
    position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: #fff;
    border: none; color: #B4553F; display: flex; align-items: center; justify-content: center; cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }
  .pos-photo-add {
    width: 56px; height: 56px; border: 1px dashed #7EC8EA; border-radius: 8px; background: #F0F8FC;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    color: #1B3B8C; font-size: 9px; cursor: pointer;
  }

  .pos-fab {
    display: none; position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px; border-radius: 50%;
    background: #1B3B8C; color: #fff; border: none; align-items: center; justify-content: center;
    box-shadow: 0 6px 18px rgba(15,35,94,0.35); z-index: 15; cursor: pointer;
  }
  .pos-fab-badge {
    position: absolute; top: -2px; right: -2px; background: #E8935C; color: #fff; font-size: 11px;
    font-weight: 700; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  }

  @media (max-width: 900px) {
    .pos-body { flex-direction: column; }
    .pos-cart {
      width: 100%; height: 100%; position: fixed; top: 0; right: -100%; transition: right 0.25s ease; z-index: 30;
    }
    .pos-cart.open { right: 0; }
    .pos-cart-header { display: flex; }
    .pos-fab { display: flex; }
  }

  .pos-modal-overlay {
    position: fixed; inset: 0; background: rgba(15,35,94,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 50; padding: 16px;
  }
  .pos-weight-box {
    background: #fff; border-radius: 18px; padding: 26px; max-width: 340px; width: 100%; text-align: center;
  }
  .pos-weight-box h3 { margin: 0 0 4px; font-size: 16px; }
  .pos-weight-box p { margin: 0 0 16px; color: #5C7391; font-size: 13px; }
  .pos-weight-box input {
    width: 100%; text-align: center; font-size: 22px; padding: 12px; border: 1px solid #D6E7F5; border-radius: 10px;
    margin-bottom: 12px; outline: none; box-sizing: border-box;
  }
  .pos-weight-quick { display: flex; gap: 8px; margin-bottom: 16px; }
  .pos-weight-quick button {
    flex: 1; border: 1px solid #D6E7F5; background: #F6FBFE; border-radius: 8px; padding: 8px; cursor: pointer; font-weight: 600;
  }
  .pos-weight-actions { display: flex; gap: 10px; }
  .pos-weight-actions .pos-header-btn { background: #F1EEE5; color: #16233D; flex: 1; justify-content: center; }
  .pos-weight-actions .pos-checkout-btn { flex: 1; }

  .pos-login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .pos-login-card {
    background: #fff; border-radius: 20px; padding: 32px 26px; max-width: 340px; width: 100%;
    display: flex; flex-direction: column; gap: 12px; box-shadow: 0 10px 30px rgba(15,35,94,0.12);
  }
  .pos-login-icon { width: 46px; height: 46px; border-radius: 14px; background: #1B3B8C; color: #fff; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
  .pos-login-card h1 { font-family: Georgia, serif; font-size: 20px; margin: 0; }
  .pos-login-card p { font-size: 13px; color: #5C7391; margin: -6px 0 6px; }
  .pos-login-card input { border: 1px solid #D6E7F5; border-radius: 9px; padding: 10px 12px; font-size: 13.5px; outline: none; }

  /* ===== Faktur / Receipt ===== */
  .pos-receipt-modal {
    background: #E1EFF9; border-radius: 18px; max-width: 420px; width: 100%; max-height: 88vh;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .pos-receipt-modal-header { padding: 14px 18px; border-bottom: 1px solid #D6E7F5; }
  .pos-receipt-modal-header h3 { margin: 0; font-family: Georgia, serif; font-size: 16px; }
  .pos-receipt-modal-body { padding: 16px; overflow-y: auto; overflow-x: auto; display: flex; justify-content: center; }
  .pos-receipt-modal-footer { display: flex; gap: 8px; padding: 14px 18px; border-top: 1px solid #D6E7F5; flex-wrap: wrap; }
  .pos-receipt-modal-footer > button { flex: 1; min-width: 90px; }
  .pos-share-msg { font-size: 11.5px; color: #5C7391; text-align: center; padding: 0 18px; }

  .pos-capture-offscreen { position: fixed; top: 0; left: -9999px; z-index: -1; pointer-events: none; }
  #pos-print-area { display: none; }
  @media print {
    .pos-header, .pos-body, .pos-fab { display: none !important; }
    .pos-modal-overlay > *:not(#pos-print-area) { display: none !important; }
    #pos-print-area { display: block !important; }
    body { margin: 0; }
  }

  .pos-receipt {
    background: #fff; border-radius: 6px; overflow: hidden; font-family: 'IBM Plex Mono', monospace;
    color: #262420; box-shadow: 0 2px 14px rgba(0,0,0,0.08);
  }
  .pos-receipt-notch { display: flex; justify-content: space-between; padding: 0 6px; background: #EDEAE0; }
  .pos-receipt-notch span { width: 8px; height: 8px; border-radius: 50%; background: #EDEAE0; box-shadow: 0 0 0 4px #fff inset; margin-top: -4px; }
  .pos-receipt-body { padding: 16px 20px 18px; }
  .pos-receipt-brand { display: flex; align-items: flex-start; gap: 10px; color: #0F235E; }
  .pos-receipt-brand-name { font-family: Georgia, serif; font-weight: 700; font-size: 16px; }
  .pos-receipt-brand-sub { font-size: 10.5px; color: #7A7568; }
  .pos-receipt-divider { border-top: 1px dashed #C9C3B2; margin: 8px 0; }
  .pos-receipt-meta { display: flex; flex-direction: column; gap: 2px; font-size: 11.5px; }
  .pos-receipt-meta > div { display: flex; justify-content: space-between; gap: 10px; }
  .pos-receipt-meta span { color: #7A7568; }
  .pos-receipt-items { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .pos-receipt-items td { padding: 4px 0; vertical-align: top; }
  .pos-receipt-item-sub { font-size: 10px; color: #8B8676; margin-top: 1px; }
  .pos-right { text-align: right; }
  .pos-receipt-total-row { display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; font-weight: 700; }
  .pos-receipt-total-row strong { font-size: 17px; color: #0F235E; }
  .pos-receipt-total-row.pos-sub { font-size: 11px; font-weight: 500; color: #7A7568; }
  .pos-receipt-rounding { margin-bottom: 4px; }
  .pos-receipt-stamp {
    display: inline-block; margin: 10px auto 4px; border: 2.5px solid #2E7BC4; color: #2E7BC4;
    font-weight: 700; font-size: 13px; padding: 4px 14px; border-radius: 6px; transform: rotate(-6deg); letter-spacing: 1.5px;
  }
  .pos-receipt-stamp.unpaid { border-color: #B4553F; color: #B4553F; }
  .pos-receipt-footer { text-align: center; font-size: 10.5px; color: #8B8676; margin-top: 6px; }
  .pos-receipt-tracking {
    text-align: center; font-size: 9.5px; color: #1B3B8C; margin-top: 8px; line-height: 1.5;
    border-top: 1px dashed #C9C3B2; padding-top: 8px; font-weight: 600;
  }
  .pos-receipt-attachment { padding: 16px 20px 20px; border-top: 1px dashed #B9D3E8; }
  .pos-receipt-attachment-header { font-family: Georgia, serif; font-weight: 700; font-size: 14px; color: #0F235E; margin-bottom: 2px; }
  .pos-receipt-attachment-sub { font-size: 10.5px; color: #6E85A0; margin-bottom: 12px; }
  .pos-receipt-attachment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .pos-receipt-attachment-grid img { width: 100%; border-radius: 8px; border: 1px solid #D6E7F5; display: block; object-fit: cover; }

  .pos-receipt.size-58mm { width: 58mm; font-size: 9px; }
  .pos-receipt.size-80mm { width: 80mm; font-size: 10.5px; }
  .pos-receipt.size-a5 { width: 148mm; font-size: 13px; }
  .pos-receipt.size-a4 { width: 190mm; font-size: 14px; }
  .pos-receipt.sheet { font-family: 'Inter', sans-serif; border-radius: 12px; }
  .pos-receipt.sheet .pos-receipt-body { padding: 30px 36px 36px; }
`;
