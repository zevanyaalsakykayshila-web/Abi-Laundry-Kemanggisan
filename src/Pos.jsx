import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { storage } from "./storage";
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
} from "lucide-react";

const STORAGE_SETTINGS = "bersih_laundry_settings_v1";
const STORAGE_TRANSACTIONS = "bersih_laundry_transactions_v1";
const PAYMENT_STATUSES = ["Belum Bayar", "Kurang Bayar", "Lunas"];
const AUTH_EMAIL_DOMAIN = "abilaundry.local";

const defaultSettings = {
  businessName: "Abi Laundry Kemanggisan",
  services: [],
  itemPrices: [],
  roundingEnabled: true,
  phone: "",
  footerNote: "",
};

function usernameToAuthEmail(username) {
  return `${username.trim().toLowerCase().replace(/\s+/g, "")}@${AUTH_EMAIL_DOMAIN}`;
}

function formatRupiah(n) {
  const num = Number(n) || 0;
  return "Rp " + num.toLocaleString("id-ID");
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

export default function Pos() {
  const [session, setSession] = useState(undefined);
  const [settings, setSettings] = useState(defaultSettings);
  const [txnCount, setTxnCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [cart, setCart] = useState([]);
  const [weightPrompt, setWeightPrompt] = useState(null); // { service }
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateEst, setDateEst] = useState(addDaysISO(2));
  const [paymentStatus, setPaymentStatus] = useState("Belum Bayar");
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
        if (r && r.value) setSettings({ ...defaultSettings, ...JSON.parse(r.value) });
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
          r.rowId === existing.rowId
            ? { ...r, qty: r.qty + 1, subtotal: (r.qty + 1) * r.price }
            : r
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

  const resetOrder = () => {
    setCart([]);
    setCustomerName("");
    setPhone("");
    setDateEst(addDaysISO(2));
    setPaymentStatus("Belum Bayar");
    setError("");
    setSuccessTxn(null);
    setCartOpen(false);
  };

  const handleCheckout = async () => {
    if (!customerName.trim()) {
      setError("Nama pelanggan wajib diisi.");
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
      dateIn: todayISO(),
      dateEst,
      items: cart,
      additionalFee: 0,
      notes: "",
      subtotalAmount: subtotal,
      roundingAmount,
      total,
      status: "Diproses",
      paymentStatus,
      photos: [],
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

  const sendWhatsapp = () => {
    if (!successTxn) return;
    const lines = [
      `*${settings.businessName}*`,
      `No. Faktur: ${successTxn.invoiceNo}`,
      `Total: ${formatRupiah(successTxn.total)}`,
      `Status Bayar: ${successTxn.paymentStatus}`,
      "",
      "Lacak status pesanan Anda di abilaundrykemanggisan.my.id/lacak",
    ];
    const wPhone = toWhatsappPhone(successTxn.phone);
    const url = wPhone
      ? `https://wa.me/${wPhone}?text=${encodeURIComponent(lines.join("\n"))}`
      : `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href = url;
  };

  if (session === undefined) {
    return <CenterMsg text="Memeriksa sesi login..." />;
  }
  if (!session) {
    return <PosLogin />;
  }
  if (!loaded) {
    return <CenterMsg text="Memuat data..." />;
  }

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
          <a href="/admin" className="pos-header-btn">
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
                      <Icon size={26} />
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
                      <Icon size={26} />
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
                    {r.calcType === "kg" ? `${r.weight} kg x ${formatRupiah(r.price)}` : `${r.qty} x ${formatRupiah(r.price)}`}
                  </span>
                </div>
                <div className="pos-cart-item-right">
                  <span className="mono">{formatRupiah(r.subtotal)}</span>
                  {r.calcType === "pcs" ? (
                    <div className="pos-qty-btns">
                      <button onClick={() => decPcs(r.rowId)} type="button">
                        <Minus size={12} />
                      </button>
                      <button onClick={() => addPcsToCart({ id: r.itemId, name: r.name.replace("Cucian Satuan - ", ""), price: r.price })} type="button">
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
            <label className="pos-field">
              <span>Estimasi Selesai</span>
              <input type="date" value={dateEst} onChange={(e) => setDateEst(e.target.value)} />
            </label>
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

      {successTxn && (
        <div className="pos-modal-overlay">
          <div className="pos-success-box">
            <div className="pos-success-icon">✓</div>
            <h3>Transaksi Tersimpan!</h3>
            <div className="pos-success-invoice">{successTxn.invoiceNo}</div>
            <div className="pos-success-total">{formatRupiah(successTxn.total)}</div>
            <button className="pos-checkout-btn" onClick={sendWhatsapp} type="button">
              <MessageCircle size={16} /> Kirim ke WhatsApp
            </button>
            <button className="pos-header-btn pos-success-new" onClick={resetOrder} type="button">
              Transaksi Baru
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: "#5b6b68" }}>
      {text}
    </div>
  );
}

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
  .pos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
  .pos-tile {
    position: relative; border: none; border-radius: 14px; padding: 16px 10px; color: #fff; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
    box-shadow: 0 4px 10px rgba(15,35,94,0.15);
  }
  .pos-tile:active { transform: scale(0.96); }
  .pos-tile-name { font-size: 12.5px; font-weight: 700; line-height: 1.25; }
  .pos-tile-price { font-size: 11px; opacity: 0.85; }
  .pos-tile-badge {
    position: absolute; top: -6px; right: -6px; background: #E8935C; color: #fff; font-size: 11px;
    font-weight: 700; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center;
    justify-content: center; border: 2px solid #EAF4FB;
  }

  .pos-cart {
    width: 340px; background: #fff; border-left: 1px solid #D6E7F5; display: flex; flex-direction: column;
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
  .mono { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; }
  .pos-qty-btns { display: flex; gap: 4px; }
  .pos-qty-btns button {
    width: 20px; height: 20px; border-radius: 5px; border: 1px solid #D6E7F5; background: #fff;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .pos-remove-btn { background: #F7E9E5; color: #B4553F; border: none; width: 24px; height: 24px; border-radius: 6px; cursor: pointer; }

  .pos-cart-footer { border-top: 1px solid #D6E7F5; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .pos-field { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; font-weight: 600; color: #33415C; }
  .pos-field input { border: 1px solid #D6E7F5; border-radius: 8px; padding: 8px 10px; font-size: 13px; outline: none; }
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
  .pos-weight-box, .pos-success-box {
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

  .pos-success-icon {
    width: 54px; height: 54px; border-radius: 50%; background: #DCEEE5; color: #1F6B45; font-size: 26px;
    display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;
  }
  .pos-success-box h3 { margin: 0 0 10px; }
  .pos-success-invoice { font-family: 'IBM Plex Mono', monospace; font-size: 14px; color: #5C7391; margin-bottom: 4px; }
  .pos-success-total { font-family: 'IBM Plex Mono', monospace; font-size: 26px; font-weight: 700; color: #0F235E; margin-bottom: 18px; }
  .pos-success-new { width: 100%; justify-content: center; margin-top: 10px; }

  .pos-login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .pos-login-card {
    background: #fff; border-radius: 20px; padding: 32px 26px; max-width: 340px; width: 100%;
    display: flex; flex-direction: column; gap: 12px; box-shadow: 0 10px 30px rgba(15,35,94,0.12);
  }
  .pos-login-icon { width: 46px; height: 46px; border-radius: 14px; background: #1B3B8C; color: #fff; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
  .pos-login-card h1 { font-family: Georgia, serif; font-size: 20px; margin: 0; }
  .pos-login-card p { font-size: 13px; color: #5C7391; margin: -6px 0 6px; }
  .pos-login-card input { border: 1px solid #D6E7F5; border-radius: 9px; padding: 10px 12px; font-size: 13.5px; outline: none; }
`;
