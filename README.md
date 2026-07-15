# Abi Laundry Kemanggisan — Panduan Pasang ke Domain Sendiri

Kode aplikasinya sudah siap. Ini langkah-langkah yang tersisa, dari nol sampai
`abilaundry.my.id` bisa diakses siapa saja. Ikuti urut dari atas, satu-satu.

---

## Langkah 1 — Beli domain `.my.id`
(Kalau sudah beli, lewati ke Langkah 2)

Beli di Niagahoster / Rumahweb / IDCloudHost. Tidak perlu dokumen apa pun untuk `.my.id`.

---

## Langkah 2 — Bikin database gratis di Supabase

Ini tempat menyimpan data transaksi & pengaturan (pengganti penyimpanan bawaan Claude).

1. Buka **supabase.com** → **Start your project** → daftar pakai email/Google (gratis)
2. Klik **New Project**
   - Nama proyek: `abi-laundry` (bebas)
   - Password database: buat password, **simpan baik-baik** (jarang dipakai lagi, tapi jaga-jaga)
   - Region: pilih **Southeast Asia (Singapore)** biar cepat
3. Tunggu ± 2 menit sampai proyeknya selesai dibuat
4. Di menu sebelah kiri, klik **SQL Editor** → **New query**
5. Copy-paste kode ini, lalu klik **Run**:

```sql
create table kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table kv_store enable row level security;

create policy "Izinkan akses publik untuk app laundry"
on kv_store for all
using (true)
with check (true);
```

   > Catatan: policy ini membuat data bisa dibaca/ditulis oleh siapa pun yang
   > membuka link websitenya — sama seperti link Claude yang kemarin. Cukup
   > aman untuk 1 usaha kecil selama linknya tidak disebar sembarangan.

6. Di menu kiri, klik **Project Settings** (ikon gerigi) → **API**
7. Catat/copy dua nilai ini, akan dipakai di Langkah 4:
   - **Project URL** (bentuknya `https://xxxxx.supabase.co`)
   - **anon public key** (deretan huruf/angka panjang)

---

## Langkah 3 — Upload kode ke GitHub

GitHub itu tempat "titip" kode supaya Vercel bisa mengambilnya.

1. Buka **github.com** → daftar akun (gratis) kalau belum punya
2. Klik tombol **+** di kanan atas → **New repository**
3. Nama repo: `abi-laundry` → **Create repository**
4. Di halaman repo baru, klik **uploading an existing file**
5. Drag & drop **semua file dan folder** di dalam folder `abi-laundry-app` ini
   (kecuali folder `node_modules` kalau ada — biasanya belum ada)
6. Scroll bawah, klik **Commit changes**

---

## Langkah 4 — Deploy ke Vercel

1. Buka **vercel.com** → login pakai akun GitHub kamu (paling gampang, tinggal klik)
2. Klik **Add New** → **Project**
3. Pilih repo `abi-laundry` tadi → klik **Import**
4. Sebelum klik Deploy, buka bagian **Environment Variables**, tambahkan 2 baris:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | (Project URL dari Langkah 2) |
   | `VITE_SUPABASE_ANON_KEY` | (anon public key dari Langkah 2) |
5. Klik **Deploy**, tunggu 1-2 menit
6. Selesai — Vercel kasih link sementara (`abi-laundry.vercel.app`), coba buka untuk pastikan aplikasinya jalan

---

## Langkah 5 — Sambungkan domain `.my.id`

1. Di project Vercel tadi, buka tab **Settings** → **Domains**
2. Ketik `abilaundry.my.id` → **Add**
3. Vercel akan kasih 1-2 baris kode (nama: `A` atau `CNAME`) yang perlu dimasukkan
   ke pengaturan DNS domain kamu
4. Buka lagi situs tempat beli domain (Niagahoster/dll) → cari menu **DNS Management** /
   **Kelola DNS** → masukkan baris yang diberikan Vercel tadi
5. Tunggu 15 menit – 1 jam (kadang sampai 24 jam) sampai aktif
6. Cek dengan buka `www.abilaundry.my.id` di browser

---

Kalau macet di langkah mana pun, screenshot saja dan kirim ke chat — nanti dibantu
diagnosa sesuai apa yang muncul di layar.
