// app/display/page.tsx
type Meeting = {
  waktu: string;
  ruang: string;
  lantai: string;
  topik: string;
  subtopik: string;
  pic: string;
  organizer: string;
  status: "IN_PROGRESS" | "STARTING_SOON" | "ON_TIME" | "POSTPONED";
};

const meetings: Meeting[] = [
  {
    waktu: "08:00 - 09:00",
    ruang: "Ruang Jakarta",
    lantai: "Lantai 2",
    topik: "Weekly Operational Review",
    subtopik: "Review kinerja dan rencana minggu ini",
    pic: "Operations Team",
    organizer: "Budi Setiawan",
    status: "IN_PROGRESS",
  },
  {
    waktu: "09:00 - 10:00",
    ruang: "Ruang Bandung",
    lantai: "Lantai 2",
    topik: "Marketing Campaign 12.12",
    subtopik: "Pembahasan strategi kampanye",
    pic: "Marketing Team",
    organizer: "Sarah Anindita",
    status: "STARTING_SOON",
  },
  {
    waktu: "10:00 - 11:00",
    ruang: "Ruang Semarang",
    lantai: "Lantai 1",
    topik: "Review Penjualan & Target Q4",
    subtopik: "Evaluasi penjualan dan rencana Q4",
    pic: "Sales Team",
    organizer: "Dimas Pratama",
    status: "ON_TIME",
  },
  {
    waktu: "16:00 - 17:00",
    ruang: "Ruang Belitung",
    lantai: "Lantai 1",
    topik: "Rapat Direksi",
    subtopik: "Pembahasan strategi perusahaan",
    pic: "Direksi",
    organizer: "Management Team",
    status: "POSTPONED",
  },
];

const statusStyle = {
  IN_PROGRESS: "bg-green-500 text-white",
  STARTING_SOON: "bg-yellow-400 text-black",
  ON_TIME: "bg-slate-600 text-white",
  POSTPONED: "bg-red-600 text-white",
};

const statusLabel = {
  IN_PROGRESS: "SEDANG BERLANGSUNG",
  STARTING_SOON: "SEGERA DIMULAI",
  ON_TIME: "SESUAI JADWAL",
  POSTPONED: "DITUNDA",
};

export default function DisplayPage() {
  return (
    <div className="min-h-screen bg-[#0a1931] text-white p-4 font-sans">
      {/* HEADER - Persis kayak gambarmu */}
      <div className="bg-[#0d2a7a] rounded-t-xl p-6 flex justify-between items-center border-b-4 border-yellow-400">
        <div className="flex items-center gap-4">
          <div className="bg-yellow-400 text-blue-900 p-3 rounded-lg text-3xl">
            👥
          </div>
          <div>
            <h1 className="text-4xl font-black">JADWAL RAPAT</h1>
            <p className="text-yellow-400 font-bold tracking-widest">
              MEETING SCHEDULE
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm opacity-80">Jumat, 17 Oktober 2026</p>
          <p className="text-5xl font-bold">08:24</p>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-[#0f2240] rounded-b-xl overflow-hidden">
        <div className="grid grid-cols-12 bg-black/30 p-3 text-xs text-yellow-400 font-bold">
          <div className="col-span-2">WAKTU / TIME</div>
          <div className="col-span-2">RUANG RAPAT</div>
          <div className="col-span-4">TOPIK RAPAT</div>
          <div className="col-span-2">PIC / ORGANIZER</div>
          <div className="col-span-2">STATUS</div>
        </div>

        {meetings.map((m, i) => (
          <div
            key={i}
            className="grid grid-cols-12 p-4 border-t border-white/10 items-center hover:bg-white/5"
          >
            <div className="col-span-2 font-bold">{m.waktu}</div>
            <div className="col-span-2">
              <p className="font-bold text-blue-300">{m.ruang}</p>
              <p className="text-xs opacity-60">{m.lantai}</p>
            </div>
            <div className="col-span-4">
              <p className="font-bold">{m.topik}</p>
              <p className="text-xs opacity-60">{m.subtopik}</p>
            </div>
            <div className="col-span-2">
              <p className="font-semibold">{m.pic}</p>
              <p className="text-xs opacity-60">{m.organizer}</p>
            </div>
            <div className="col-span-2">
              <span
                className={`px-3 py-1.5 rounded-md text-xs font-black ${statusStyle[m.status]}`}
              >
                {statusLabel[m.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
