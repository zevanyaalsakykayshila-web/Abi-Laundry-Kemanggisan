import React, { useEffect, useState } from "react";
import { storage } from "./storage";
import {
  Shirt,
  MapPin,
  Phone,
  Clock,
  MessageCircle,
  Search,
  ShieldCheck,
  Heart,
  Timer,
  Sparkles,
  Truck,
  CheckCircle2,
} from "lucide-react";

const STORAGE_SETTINGS = "bersih_laundry_settings_v1";
const STORAGE_PICKUP = "bersih_laundry_pickup_requests_v1";
const TIME_SLOTS = ["Pagi (09.00–12.00)", "Siang (12.00–15.00)", "Sore (15.00–18.00)", "Malam (18.00–20.00)"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return `pu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generatePickupCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O dan 1/I biar tidak ketuker
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function formatRupiah(n) {
  const num = Number(n) || 0;
  return "Rp " + num.toLocaleString("id-ID");
}

const DEFAULT_INFO = {
  businessName: "Abi Laundry Kemanggisan",
  address: "Jl. Anggrek Rosliana No.9, RT.9/RW.5, Kemanggisan, Palmerah, Jakarta Barat",
  phone: "0896-3402-3067",
  hours: "Setiap hari 09.30 – 20.30",
  services: [],
  itemPrices: [],
};

export default function Profile() {
  const [settings, setSettings] = useState(DEFAULT_INFO);

  useEffect(() => {
    storage
      .get(STORAGE_SETTINGS)
      .then((r) => {
        if (r && r.value) {
          const parsed = JSON.parse(r.value);
          setSettings({ ...DEFAULT_INFO, ...parsed });
        }
      })
      .catch(() => {});
  }, []);

  const waLink = `https://wa.me/${(settings.phone || "").replace(/[^0-9]/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(
    "Halo Abi Laundry, saya mau tanya-tanya soal layanan cucian ya 🙂"
  )}`;

  return (
    <div className="pf-root">
      <style>{CSS}</style>

      {/* ===== NAV ===== */}
      <header className="pf-nav">
        <div className="pf-nav-inner">
          <div className="pf-nav-brand">
            <img src="/profil-img/logo.jpg" alt="Logo Abi Laundry" className="pf-nav-logo" />
            <span>{settings.businessName}</span>
          </div>
          <a href="/lacak" className="pf-nav-cta">
            <Search size={14} /> Cek Status Cucian
          </a>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="pf-hero">
        <div className="pf-hero-inner">
          <img src="/profil-img/logo.jpg" alt="Abi Laundry" className="pf-hero-logo" />
          <h1>{settings.businessName}</h1>
          <p className="pf-hero-tagline">Bersih rapinya, tulus kerjanya — seperti mencuci untuk keluarga sendiri.</p>
          <div className="pf-hero-btns">
            <a href={waLink} className="pf-btn pf-btn-primary">
              <MessageCircle size={16} /> Chat WhatsApp
            </a>
            <a href="/lacak" className="pf-btn pf-btn-ghost">
              <Search size={16} /> Cek Status Cucian
            </a>
          </div>
        </div>
      </section>

      {/* ===== CERITA KAMI ===== */}
      <section className="pf-section pf-story">
        <div className="pf-container pf-story-grid">
          <div className="pf-story-photo">
            <img src="/profil-img/mamah-abi.jpg" alt="Mamah Abi, pendiri Abi Laundry" />
          </div>
          <div className="pf-story-text">
            <span className="pf-eyebrow">Cerita Kami</span>
            <h2>Dari Satu Mesin Cuci, Untuk Keluarga</h2>
            <p>
              Semua bermula dari rumah sendiri, di lingkungan Kemanggisan, dengan modal satu mesin cuci.
            </p>
            <p>
              Ada masa ketika Mamah Abi harus mengambil keputusan yang berat — sepeninggal sang suami, giliran
              beliau yang harus berdiri di depan, mencari nafkah dan mencukupi kebutuhan keluarga sendirian.
              Tidak ada modal besar, tidak ada tempat mewah. Hanya tekad yang kuat, dan cinta untuk
              anak-anaknya.
            </p>
            <p>
              Dari sanalah <strong>Abi Laundry</strong> lahir — namanya diambil dari sang anak bungsu, Abi,
              sebagai pengingat bahwa usaha ini dibangun untuk masa depan mereka.
            </p>
            <p>
              Hari demi hari, cucian demi cucian, kepercayaan tetangga dan pelanggan pertama tumbuh. Satu
              mesin cuci itu menjadi saksi bagaimana kerja keras dan kejujuran bisa membawa usaha kecil ini
              bertahan dan berkembang, sampai hari ini.
            </p>
            <p>
              Bagi kami, setiap cucian yang datang tetap diperlakukan seperti cucian keluarga sendiri — karena
              begitulah caranya semua ini dimulai. Terima kasih sudah menjadi bagian dari perjalanan kami.
            </p>
          </div>
        </div>
      </section>

      {/* ===== NILAI KAMI ===== */}
      <section className="pf-section pf-values">
        <div className="pf-container">
          <span className="pf-eyebrow center">Kenapa Pilih Kami</span>
          <h2 className="pf-center">Dikerjakan Seperti Untuk Keluarga Sendiri</h2>
          <div className="pf-values-grid">
            <div className="pf-value-card">
              <ShieldCheck size={22} />
              <h3>Jujur & Transparan</h3>
              <p>Berat timbangan jelas, bisa dilampirkan buktinya di setiap faktur.</p>
            </div>
            <div className="pf-value-card">
              <Timer size={22} />
              <h3>Selalu Tepat Waktu</h3>
              <p>Estimasi selesai kami sampaikan di awal, dan kami usahakan selalu tepat.</p>
            </div>
            <div className="pf-value-card">
              <Heart size={22} />
              <h3>Ramah Seperti Keluarga</h3>
              <p>Usaha ini tumbuh dari kepercayaan tetangga — itu yang terus kami jaga.</p>
            </div>
            <div className="pf-value-card">
              <Sparkles size={22} />
              <h3>Bersih & Wangi Tahan Lama</h3>
              <p>Dicuci dan disetrika rapi, siap pakai kembali.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LAYANAN ===== */}
      <section className="pf-section pf-services">
        <div className="pf-container">
          <span className="pf-eyebrow center">Layanan Kami</span>
          <h2 className="pf-center">Harga Terupdate</h2>
          <div className="pf-services-grid">
            {settings.services?.map((s) => (
              <div className="pf-service-card" key={s.id}>
                <span className="pf-service-name">{s.name}</span>
                <span className="pf-service-price">{formatRupiah(s.pricePerKg)}/kg</span>
              </div>
            ))}
          </div>
          {settings.itemPrices?.length > 0 && (
            <>
              <p className="pf-services-sub">Cucian satuan:</p>
              <div className="pf-services-grid pf-services-grid-sm">
                {settings.itemPrices.map((it) => (
                  <div className="pf-service-card small" key={it.id}>
                    <span className="pf-service-name">{it.name}</span>
                    <span className="pf-service-price">{formatRupiah(it.price)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ===== GALERI ===== */}
      <section className="pf-section pf-gallery">
        <div className="pf-container">
          <span className="pf-eyebrow center">Galeri</span>
          <h2 className="pf-center">Kebersamaan Keluarga Abi Laundry</h2>
          <div className="pf-gallery-grid">
            <img src="/profil-img/keluarga-1.jpg" alt="Kebersamaan keluarga" />
            <img src="/profil-img/kebersamaan.jpg" alt="Momen kebersamaan" />
            <img src="/profil-img/banner-layanan.jpg" alt="Layanan Abi Laundry" className="pf-gallery-wide" />
          </div>
        </div>
      </section>

      {/* ===== JADWALKAN PENJEMPUTAN ===== */}
      <section className="pf-section pf-pickup">
        <div className="pf-container">
          <span className="pf-eyebrow center">Antar-Jemput</span>
          <h2 className="pf-center">Jadwalkan Penjemputan</h2>
          <PickupForm settings={settings} />
        </div>
      </section>

      {/* ===== LOKASI ===== */}
      <section className="pf-section pf-location">
        <div className="pf-container pf-location-grid">
          <div>
            <span className="pf-eyebrow">Kunjungi Kami</span>
            <h2>Lokasi &amp; Kontak</h2>
            <div className="pf-info-row">
              <MapPin size={17} />
              <span>{settings.address}</span>
            </div>
            <div className="pf-info-row">
              <Clock size={17} />
              <span>{settings.hours}</span>
            </div>
            <div className="pf-info-row">
              <Phone size={17} />
              <span>{settings.phone}</span>
            </div>
            <a href={waLink} className="pf-btn pf-btn-primary" style={{ marginTop: 16 }}>
              <MessageCircle size={16} /> Chat via WhatsApp
            </a>
          </div>
          <a
            className="pf-map-embed"
            href="https://www.google.com/maps/search/?api=1&query=Abi+Laundry+Kemanggisan+Jakarta+Barat"
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={26} />
            <span>Buka di Google Maps</span>
          </a>
        </div>
      </section>

      <footer className="pf-footer">
        <Shirt size={16} />
        <span>{settings.businessName} — dengan cinta, sejak dari rumah.</span>
      </footer>
    </div>
  );
}

function PickupForm({ settings }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastRequest, setLastRequest] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !address.trim() || !date) {
      setError("Nama, No. HP, Alamat, dan Tanggal wajib diisi.");
      return;
    }
    setError("");
    setSubmitting(true);

    const request = {
      id: uid(),
      code: generatePickupCode(),
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      date,
      timeSlot,
      notes: notes.trim(),
      status: "Baru",
      adminNote: "",
      createdAt: new Date().toISOString(),
    };

    try {
      const r = await storage.get(STORAGE_PICKUP).catch(() => null);
      const list = r && r.value ? JSON.parse(r.value) : [];
      await storage.set(STORAGE_PICKUP, JSON.stringify([request, ...list]));
    } catch (err) {
      /* tetap lanjut walau simpan gagal, supaya tidak ke-block */
    }

    setSubmitting(false);
    setLastRequest(request);
    setSubmitted(true);
  };

  const sendToWhatsapp = () => {
    if (!lastRequest) return;
    const waText = [
      "*Permintaan Jadwal Penjemputan*",
      `Kode: ${lastRequest.code}`,
      `Nama: ${lastRequest.name}`,
      `No. HP: ${lastRequest.phone}`,
      `Alamat: ${lastRequest.address}`,
      `Tanggal: ${lastRequest.date}`,
      `Waktu: ${lastRequest.timeSlot}`,
      lastRequest.notes ? `Catatan: ${lastRequest.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const businessPhone = (settings.phone || "").replace(/[^0-9]/g, "").replace(/^0/, "62");
    window.location.href = `https://wa.me/${businessPhone}?text=${encodeURIComponent(waText)}`;
  };

  if (submitted) {
    return (
      <div className="pf-pickup-success">
        <CheckCircle2 size={28} />
        <h3>Permintaan Terkirim!</h3>
        <p>Jadwal penjemputan kamu sudah kami terima.</p>
        <div className="pf-pickup-code">
          <span>Kode Pelacakan Kamu</span>
          <strong>{lastRequest?.code}</strong>
          <span className="pf-pickup-code-hint">Simpan kode ini untuk cek status penjemputan kapan saja.</span>
        </div>
        <button className="pf-btn pf-btn-primary" onClick={sendToWhatsapp} type="button" style={{ marginBottom: 10 }}>
          <MessageCircle size={16} /> Konfirmasi via WhatsApp
        </button>
        <a href="/lacak" className="pf-btn pf-btn-ghost-dark" style={{ marginBottom: 10 }}>
          <Search size={16} /> Cek Status Sekarang
        </a>
        <button
          className="pf-btn pf-btn-ghost-dark"
          onClick={() => {
            setSubmitted(false);
            setLastRequest(null);
          }}
          type="button"
        >
          Buat Jadwal Lain
        </button>
      </div>
    );
  }

  return (
    <form className="pf-pickup-form" onSubmit={handleSubmit}>
      <div className="pf-pickup-grid">
        <label className="pf-field">
          <span>Nama *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Anda" />
        </label>
        <label className="pf-field">
          <span>No. HP / WhatsApp *</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xx-xxxx-xxxx" />
        </label>
      </div>
      <label className="pf-field">
        <span>Alamat Penjemputan *</span>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Alamat lengkap untuk dijemput"
          rows={2}
        />
      </label>
      <div className="pf-pickup-grid">
        <label className="pf-field">
          <span>Tanggal Penjemputan *</span>
          <input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="pf-field">
          <span>Waktu</span>
          <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
            {TIME_SLOTS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="pf-field">
        <span>Catatan (opsional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contoh: perkiraan 3kg, ada sprei"
          rows={2}
        />
      </label>

      {error && <div className="pf-pickup-error">{error}</div>}

      <button className="pf-btn pf-btn-primary pf-pickup-submit" type="submit" disabled={submitting}>
        <Truck size={16} /> {submitting ? "Mengirim..." : "Jadwalkan Penjemputan"}
      </button>
    </form>
  );
}

const CSS = `
  .pf-root { background: #EAF4FB; color: #16233D; font-family: 'Inter', sans-serif; }
  .pf-root h1, .pf-root h2, .pf-root h3 { font-family: Georgia, 'Fraunces', serif; margin: 0; }
  .pf-container { max-width: 980px; margin: 0 auto; padding: 0 20px; }
  .pf-section { padding: 56px 0; }
  .pf-eyebrow { display: block; font-size: 12.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #2E7BC4; margin-bottom: 8px; }
  .pf-eyebrow.center { text-align: center; }
  .pf-center { text-align: center; margin-bottom: 34px !important; }

  .pf-nav { position: sticky; top: 0; z-index: 20; background: rgba(27,59,140,0.96); backdrop-filter: blur(6px); }
  .pf-nav-inner { max-width: 980px; margin: 0 auto; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; }
  .pf-nav-brand { display: flex; align-items: center; gap: 10px; color: #fff; font-weight: 700; font-size: 14px; }
  .pf-nav-logo { width: 30px; height: 30px; border-radius: 8px; object-fit: cover; }
  .pf-nav-cta {
    display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); color: #fff;
    font-size: 12.5px; font-weight: 600; padding: 7px 13px; border-radius: 999px; text-decoration: none;
  }

  .pf-hero { background: linear-gradient(160deg, #2C5BB8, #0F235E); color: #fff; padding: 64px 20px 70px; text-align: center; }
  .pf-hero-inner { max-width: 560px; margin: 0 auto; }
  .pf-hero-logo { width: 96px; height: 96px; border-radius: 24px; object-fit: cover; margin-bottom: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
  .pf-hero h1 { font-size: 30px; margin-bottom: 10px; }
  .pf-hero-tagline { font-size: 14.5px; color: rgba(255,255,255,0.85); margin-bottom: 26px; }
  .pf-hero-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

  .pf-btn {
    display: inline-flex; align-items: center; gap: 7px; padding: 11px 20px; border-radius: 10px;
    font-size: 13.5px; font-weight: 700; text-decoration: none; cursor: pointer; border: none;
  }
  .pf-btn-primary { background: #25D366; color: #fff; }
  .pf-btn-ghost { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.35); }

  .pf-story { background: #fff; }
  .pf-story-grid { display: grid; grid-template-columns: 300px 1fr; gap: 40px; align-items: start; }
  @media (max-width: 760px) { .pf-story-grid { grid-template-columns: 1fr; } }
  .pf-story-photo img { width: 100%; border-radius: 18px; display: block; box-shadow: 0 10px 30px rgba(15,35,94,0.12); }
  .pf-story-text h2 { font-size: 24px; margin-bottom: 14px; color: #0F235E; }
  .pf-story-text p { font-size: 14.5px; line-height: 1.75; color: #33415C; margin: 0 0 14px; }

  .pf-values-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  @media (max-width: 760px) { .pf-values-grid { grid-template-columns: 1fr 1fr; } }
  .pf-value-card {
    background: #fff; border: 1px solid #D6E7F5; border-radius: 16px; padding: 22px 18px; text-align: center;
  }
  .pf-value-card svg { color: #1B3B8C; margin-bottom: 10px; }
  .pf-value-card h3 { font-size: 14.5px; margin-bottom: 6px; }
  .pf-value-card p { font-size: 12.5px; color: #5C7391; margin: 0; line-height: 1.5; }

  .pf-services { background: #fff; }
  .pf-services-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  @media (max-width: 760px) { .pf-services-grid { grid-template-columns: 1fr 1fr; } }
  .pf-services-grid-sm { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 760px) { .pf-services-grid-sm { grid-template-columns: 1fr 1fr; } }
  .pf-service-card {
    background: #1B3B8C; color: #fff; border-radius: 12px; padding: 16px; display: flex;
    flex-direction: column; gap: 4px; text-align: center;
  }
  .pf-service-card.small { background: #F0F8FC; color: #16233D; border: 1px solid #D6E7F5; }
  .pf-service-name { font-size: 13px; font-weight: 700; }
  .pf-service-price { font-size: 12px; opacity: 0.85; }
  .pf-services-sub { margin: 30px 0 14px; font-weight: 700; font-size: 14px; color: #16233D; }

  .pf-gallery-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .pf-gallery-grid img { width: 100%; border-radius: 14px; display: block; object-fit: cover; height: 260px; }
  .pf-gallery-wide { grid-column: span 2; height: auto !important; }
  @media (max-width: 700px) { .pf-gallery-grid { grid-template-columns: 1fr; } .pf-gallery-wide { grid-column: span 1; } }

  .pf-location { background: #fff; }
  .pf-location-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: center; }
  @media (max-width: 760px) { .pf-location-grid { grid-template-columns: 1fr; } }
  .pf-info-row { display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px; color: #33415C; margin-bottom: 10px; }
  .pf-info-row svg { color: #1B3B8C; flex-shrink: 0; margin-top: 1px; }
  .pf-map-embed {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    background: #E5F0FA; border: 1px dashed #7EC8EA; border-radius: 18px; height: 220px;
    color: #1B3B8C; font-weight: 700; font-size: 13.5px; text-decoration: none;
  }

  .pf-footer {
    display: flex; align-items: center; justify-content: center; gap: 8px; padding: 22px;
    color: #5C7391; font-size: 12px; background: #EAF4FB;
  }

  .pf-pickup { background: #fff; }
  .pf-pickup-form {
    max-width: 560px; margin: 0 auto; background: #F6FBFE; border: 1px solid #D6E7F5;
    border-radius: 18px; padding: 26px 24px; display: flex; flex-direction: column; gap: 14px;
  }
  .pf-pickup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 560px) { .pf-pickup-grid { grid-template-columns: 1fr; } }
  .pf-field { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; color: #33415C; }
  .pf-field input, .pf-field select, .pf-field textarea {
    border: 1px solid #D6E7F5; border-radius: 9px; padding: 10px 12px; font-size: 13.5px;
    font-family: 'Inter', sans-serif; color: #16233D; background: #fff; outline: none; resize: vertical;
  }
  .pf-field input:focus, .pf-field select:focus, .pf-field textarea:focus { border-color: #1B3B8C; }
  .pf-pickup-error { background: #F7E9E5; color: #B4553F; font-size: 12.5px; padding: 9px 12px; border-radius: 8px; }
  .pf-pickup-submit { justify-content: center; width: 100%; }
  .pf-pickup-success {
    max-width: 460px; margin: 0 auto; text-align: center; background: #DCEEE5; border-radius: 18px;
    padding: 34px 24px; color: #1F6B45;
  }
  .pf-pickup-success h3 { margin: 12px 0 8px; font-size: 18px; }
  .pf-pickup-success p { font-size: 13.5px; margin: 0 0 18px; color: #1F6B45; opacity: 0.9; }
  .pf-btn-ghost-dark { background: #fff; color: #1F6B45; border: 1px solid #9FD8B8; }
  .pf-pickup-code {
    background: #fff; border: 1.5px dashed #1F6B45; border-radius: 14px; padding: 16px;
    display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 6px 0 18px;
  }
  .pf-pickup-code span { font-size: 12px; color: #1F6B45; opacity: 0.8; }
  .pf-pickup-code strong { font-size: 30px; letter-spacing: 4px; color: #0F235E; font-family: 'DejaVu Sans Mono', monospace; }
  .pf-pickup-code-hint { font-size: 11.5px !important; }
`;
