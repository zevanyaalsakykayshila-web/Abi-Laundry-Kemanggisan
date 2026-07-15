import React, { useState } from "react";
import { storage } from "./storage";
import { Search, Shirt, PackageSearch } from "lucide-react";

const STORAGE_SETTINGS = "bersih_laundry_settings_v1";
const STORAGE_TRANSACTIONS = "bersih_laundry_transactions_v1";

function formatDateShort(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LacakStatus() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const [sRes, tRes] = await Promise.all([
        storage.get(STORAGE_SETTINGS).catch(() => null),
        storage.get(STORAGE_TRANSACTIONS).catch(() => null),
      ]);
      if (sRes && sRes.value) setSettings(JSON.parse(sRes.value));
      const all = tRes && tRes.value ? JSON.parse(tRes.value) : [];

      const q = query.trim().toLowerCase();
      const qDigits = q.replace(/[^0-9]/g, "");
      const matched = all.filter((t) => {
        const invMatch = t.invoiceNo && t.invoiceNo.toLowerCase().includes(q);
        const phoneMatch = qDigits.length >= 6 && t.phone && t.phone.replace(/[^0-9]/g, "").includes(qDigits);
        return invMatch || phoneMatch;
      });
      matched.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setResults(matched);
      if (matched.length === 0) {
        setError("Tidak ditemukan. Coba periksa lagi No. Faktur atau No. HP yang dimasukkan.");
      }
    } catch (err) {
      setError("Gagal memuat data, coba lagi beberapa saat.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lacak-root">
      <style>{CSS}</style>

      <header className="lacak-header">
        <div className="lacak-brand-icon">
          <Shirt size={20} />
        </div>
        <div>
          <div className="lacak-brand-name">{settings?.businessName || "Cek Status Laundry"}</div>
          {settings?.hours && <div className="lacak-brand-sub">{settings.hours}</div>}
        </div>
      </header>

      <main className="lacak-main">
        <div className="lacak-card">
          <PackageSearch size={30} className="lacak-icon" />
          <h1>Cek Status Cucian Anda</h1>
          <p>Masukkan No. Faktur (contoh: INV-20260715-001) atau No. HP yang didaftarkan saat transaksi.</p>

          <form onSubmit={handleSearch} className="lacak-form">
            <input
              className="lacak-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="No. Faktur / No. HP"
              autoComplete="off"
            />
            <button className="lacak-btn" type="submit" disabled={loading}>
              <Search size={16} /> {loading ? "Mencari..." : "Cek Status"}
            </button>
          </form>

          {error && <div className="lacak-error">{error}</div>}

          {results.length > 0 && (
            <div className="lacak-results">
              {results.map((t) => (
                <div className="lacak-result-card" key={t.id}>
                  <div className={`lacak-status-badge ${t.status === "Siap Diambil" ? "ready" : "process"}`}>
                    {t.status === "Siap Diambil" ? "✅ Siap Diambil" : "🧺 Sedang Diproses"}
                  </div>
                  <div className="lacak-result-row">
                    <span>No. Faktur</span>
                    <strong>{t.invoiceNo}</strong>
                  </div>
                  <div className="lacak-result-row">
                    <span>Nama</span>
                    <strong>{t.customerName}</strong>
                  </div>
                  <div className="lacak-result-row">
                    <span>Tanggal Masuk</span>
                    <strong>{formatDateShort(t.dateIn)}</strong>
                  </div>
                  {t.dateEst && (
                    <div className="lacak-result-row">
                      <span>Estimasi Selesai</span>
                      <strong>{formatDateShort(t.dateEst)}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {searched && !loading && results.length === 0 && !error && (
            <div className="lacak-error">Tidak ditemukan.</div>
          )}
        </div>

        {settings?.address && (
          <p className="lacak-footer-note">
            {settings.businessName} — {settings.address}
            {settings.phone ? ` • ${settings.phone}` : ""}
          </p>
        )}
      </main>
    </div>
  );
}

const CSS = `
  .lacak-root {
    min-height: 100vh; background: #EAF4FB; font-family: 'Inter', sans-serif; color: #16233D;
  }
  .lacak-header {
    background: #1B3B8C; color: #fff; padding: 16px 20px; display: flex; align-items: center; gap: 12px;
  }
  .lacak-brand-icon {
    width: 38px; height: 38px; border-radius: 11px; background: rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .lacak-brand-name { font-weight: 700; font-size: 16px; }
  .lacak-brand-sub { font-size: 11.5px; color: rgba(255,255,255,0.75); }
  .lacak-main { max-width: 480px; margin: 0 auto; padding: 28px 16px 40px; }
  .lacak-card {
    background: #fff; border: 1px solid #D6E7F5; border-radius: 20px; padding: 28px 24px;
    text-align: center; box-shadow: 0 8px 30px rgba(15,35,94,0.08);
  }
  .lacak-icon { color: #1B3B8C; margin-bottom: 8px; }
  .lacak-card h1 { font-size: 19px; margin: 0 0 8px; font-family: Georgia, serif; }
  .lacak-card p { font-size: 13px; color: #5C7391; margin: 0 0 18px; }
  .lacak-form { display: flex; gap: 8px; margin-bottom: 6px; }
  .lacak-input {
    flex: 1; border: 1px solid #D6E7F5; border-radius: 10px; padding: 11px 13px;
    font-size: 14px; outline: none; background: #F6FBFE;
  }
  .lacak-input:focus { border-color: #1B3B8C; background: #fff; }
  .lacak-btn {
    display: flex; align-items: center; gap: 6px; background: #2E7BC4; color: #fff; border: none;
    padding: 11px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 700; cursor: pointer;
  }
  .lacak-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .lacak-error {
    background: #F7E9E5; color: #B4553F; font-size: 12.5px; padding: 9px 12px; border-radius: 8px; margin-top: 10px;
  }
  .lacak-results { margin-top: 18px; display: flex; flex-direction: column; gap: 12px; text-align: left; }
  .lacak-result-card { background: #F6FBFE; border: 1px solid #D6E7F5; border-radius: 14px; padding: 16px; }
  .lacak-status-badge {
    display: inline-block; font-weight: 700; font-size: 13px; padding: 6px 14px; border-radius: 999px; margin-bottom: 10px;
  }
  .lacak-status-badge.process { background: #FBEBD4; color: #8A5A16; }
  .lacak-status-badge.ready { background: #DCEEE5; color: #1F6B45; }
  .lacak-result-row { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; padding: 4px 0; }
  .lacak-result-row span { color: #5C7391; }
  .lacak-footer-note { text-align: center; font-size: 11.5px; color: #5C7391; margin-top: 18px; }
`;
