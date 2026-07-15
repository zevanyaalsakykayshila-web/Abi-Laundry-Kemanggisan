import React, { useEffect, useState } from "react";
import { storage } from "./storage";
import { Shirt, MapPin, Phone, Clock, MessageCircle, Search, ShieldCheck, Heart, Timer, Sparkles } from "lucide-react";

const STORAGE_SETTINGS = "bersih_laundry_settings_v1";

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
            <a href={waLink} target="_blank" rel="noreferrer" className="pf-btn pf-btn-primary">
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
            <a href={waLink} target="_blank" rel="noreferrer" className="pf-btn pf-btn-primary" style={{ marginTop: 16 }}>
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
`;
