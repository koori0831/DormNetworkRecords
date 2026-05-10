export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_34rem),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_32rem),#09090b] px-5 py-8 sm:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-center gap-8">
        <div className="text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-teal-300">
            Dorm Network Records
          </p>
          <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-5xl">
            Wi-Fi 속도 기록
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            버튼 한 번으로 현재 다운로드 속도를 측정하고 Supabase에 기록합니다.
            아래 차트에서 누적 기록을 시간순으로 확인할 수 있습니다.
          </p>
        </div>

        <section className="mx-auto w-full max-w-2xl rounded-lg border border-white/10 bg-zinc-900/80 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7">
          <div id="accessPanel" className="mb-5 rounded-md border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            IP 확인 중입니다. 허용된 네트워크에서 접속했는지 검사합니다.
          </div>

          <form id="recordForm" className="grid gap-4">
            <label htmlFor="speedInput" className="text-sm font-medium text-zinc-200">
              측정 속도
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <input
                id="speedInput"
                name="speed"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="예: 850"
                className="h-14 w-full rounded-md border border-white/10 bg-zinc-950 px-4 text-lg font-medium text-white outline-none transition placeholder:text-zinc-600 focus:border-teal-300 focus:ring-4 focus:ring-teal-300/10"
              />
              <select
                id="unitSelect"
                name="unit"
                defaultValue="kbps"
                className="h-14 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none transition focus:border-teal-300 focus:ring-4 focus:ring-teal-300/10"
              >
                <option value="kbps">Kbps</option>
                <option value="mbps">Mbps</option>
              </select>
            </div>
            <p className="text-sm leading-6 text-zinc-400">
              자동 측정은 최대 약 12초 동안 진행되며, 네트워크 속도에 따라 데이터 사용량이 달라집니다.
              직접 입력할 때는 단위를 꼭 확인하세요.
            </p>

            <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <button
                id="measureButton"
                type="button"
                className="h-12 rounded-md bg-teal-400 px-5 text-sm font-bold text-zinc-950 transition hover:bg-teal-300 focus:outline-none focus:ring-4 focus:ring-teal-300/30 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                측정하고 기록하기
              </button>
              <button
                id="saveButton"
                type="submit"
                className="h-12 rounded-md border border-white/10 px-5 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/60 hover:bg-white/5 focus:outline-none focus:ring-4 focus:ring-teal-300/20 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500"
              >
                직접 기록
              </button>
              <a
                href="https://fast.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-md border border-white/10 px-5 text-sm font-semibold text-zinc-100 transition hover:border-teal-300/60 hover:bg-white/5 focus:outline-none focus:ring-4 focus:ring-teal-300/20"
              >
                fast.com
              </a>
            </div>
          </form>

          <p id="statusMessage" className="mt-4 min-h-6 text-sm text-zinc-400" aria-live="polite"></p>
        </section>

        <section className="w-full rounded-lg border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">전체 기록</h2>
              <p className="text-sm text-zinc-400">SpeedRecord 테이블의 speed 값을 시간순으로 표시합니다.</p>
            </div>
            <p id="recordCount" className="text-sm font-medium text-teal-300">0개 기록</p>
          </div>
          <div className="h-[320px] w-full sm:h-[420px]">
            <canvas id="speedChart"></canvas>
          </div>
        </section>
      </section>
      <script src="./app.js"></script>
    </main>
  );
}
