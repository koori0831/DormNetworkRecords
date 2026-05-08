(function () {
  "use strict";

  // TODO: Supabase 프로젝트 설정을 여기에 입력하세요.
  // 예: const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
  // 예: const SUPABASE_ANON_KEY = "eyJhbGciOi...";
  const SUPABASE_URL = "https://kdbxkanborozdgcqcxsi.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYnhrYW5ib3JvemRnY3FjeHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzkzMTgsImV4cCI6MjA5MzcxNTMxOH0.0bkefz9UOgRus_LxSANYPipsI9XlhCuU9jZPB2ziydQ";

  const ALLOWED_IP = "222.98.247.233";
  const TABLE_NAME = "SpeedRecord";

  const form = document.getElementById("recordForm");
  const speedInput = document.getElementById("speedInput");
  const unitSelect = document.getElementById("unitSelect");
  const saveButton = document.getElementById("saveButton");
  const statusMessage = document.getElementById("statusMessage");
  const accessPanel = document.getElementById("accessPanel");
  const recordCount = document.getElementById("recordCount");
  const chartCanvas = document.getElementById("speedChart");

  let chart;
  let isAllowedIp = false;
  let supabaseClient = null;

  function setStatus(message, tone) {
    statusMessage.textContent = message;
    statusMessage.className = "mt-4 min-h-6 text-sm " + (tone === "error" ? "text-rose-300" : tone === "success" ? "text-teal-300" : "text-zinc-400");
  }

  function setFormEnabled(enabled) {
    speedInput.disabled = !enabled;
    unitSelect.disabled = !enabled;
    saveButton.disabled = !enabled;
  }

  function hasSupabaseConfig() {
    return SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
  }

  function toKbps(value, unit) {
    return unit === "mbps" ? value * 1000 : value;
  }

  function formatTime(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function renderChart(records) {
    const labels = records.map((record) => formatTime(record.created_at));
    const data = records.map((record) => Number(record.speed));

    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.update();
      return;
    }

    chart = new Chart(chartCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "속도 (Kbps)",
            data,
            borderColor: "#2dd4bf",
            backgroundColor: "rgba(45, 212, 191, 0.16)",
            borderWidth: 3,
            pointBackgroundColor: "#f8fafc",
            pointBorderColor: "#14b8a6",
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.35,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index"
        },
        plugins: {
          legend: {
            labels: {
              color: "#d4d4d8",
              boxWidth: 14,
              boxHeight: 14
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.parsed.y.toLocaleString("ko-KR")} Kbps`
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: "rgba(255,255,255,0.06)"
            },
            ticks: {
              color: "#a1a1aa",
              maxRotation: 0,
              autoSkip: true
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(255,255,255,0.08)"
            },
            ticks: {
              color: "#a1a1aa",
              callback: (value) => Number(value).toLocaleString("ko-KR")
            }
          }
        }
      }
    });
  }

  async function verifyIp() {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      if (!response.ok) throw new Error("IP 조회 실패");

      const data = await response.json();
      isAllowedIp = data.ip === ALLOWED_IP;

      if (isAllowedIp) {
        accessPanel.className = "mb-5 rounded-md border border-teal-400/20 bg-teal-400/10 px-4 py-3 text-sm text-teal-100";
        accessPanel.textContent = `허용된 IP(${data.ip})에서 접속했습니다.`;
      } else {
        accessPanel.className = "mb-5 rounded-md border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100";
        accessPanel.textContent = `요청 거절: 현재 IP(${data.ip})는 허용된 IP가 아닙니다.`;
      }
    } catch (error) {
      isAllowedIp = false;
      accessPanel.className = "mb-5 rounded-md border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100";
      accessPanel.textContent = "요청 거절: 접속 IP를 확인할 수 없습니다.";
    }

    setFormEnabled(isAllowedIp && hasSupabaseConfig());
  }

  async function loadRecords() {
    if (!supabaseClient || !isAllowedIp) {
      renderChart([]);
      recordCount.textContent = "0개 기록";
      return;
    }

    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select("speed, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      setStatus(`기록을 불러오지 못했습니다: ${error.message}`, "error");
      return;
    }

    const records = data || [];
    recordCount.textContent = `${records.length.toLocaleString("ko-KR")}개 기록`;
    renderChart(records);
  }

  async function saveRecord(event) {
    event.preventDefault();

    if (!isAllowedIp) {
      setStatus("허용된 IP에서만 기록할 수 있습니다.", "error");
      return;
    }

    if (!supabaseClient) {
      setStatus("Supabase URL과 Anon Key를 먼저 설정하세요.", "error");
      return;
    }

    const rawSpeed = Number(speedInput.value);
    if (!Number.isFinite(rawSpeed) || rawSpeed <= 0) {
      setStatus("0보다 큰 속도 값을 입력하세요.", "error");
      speedInput.focus();
      return;
    }

    const speed = Number(toKbps(rawSpeed, unitSelect.value).toFixed(2));
    saveButton.disabled = true;
    setStatus("기록 중입니다...", "muted");

    const { error } = await supabaseClient
      .from(TABLE_NAME)
      .insert([{ speed }]);

    saveButton.disabled = false;

    if (error) {
      setStatus(`저장하지 못했습니다: ${error.message}`, "error");
      return;
    }

    speedInput.value = "";
    setStatus(`${speed.toLocaleString("ko-KR")} Kbps로 저장했습니다.`, "success");
    await loadRecords();
  }

  async function init() {
    setFormEnabled(false);
    renderChart([]);

    if (hasSupabaseConfig()) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      setStatus("Supabase URL과 Anon Key를 public/app.js에 입력하면 저장과 조회가 활성화됩니다.", "error");
    }

    await verifyIp();
    await loadRecords();
  }

  form.addEventListener("submit", saveRecord);
  init();
})();
