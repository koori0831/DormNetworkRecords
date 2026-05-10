(function () {
  "use strict";

  // TODO: Enter your Supabase project settings here.
  // Example: const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
  // Example: const SUPABASE_ANON_KEY = "eyJhbGciOi...";
  const SUPABASE_URL = "https://kdbxkanborozdgcqcxsi.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYnhrYW5ib3JvemRnY3FjeHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzkzMTgsImV4cCI6MjA5MzcxNTMxOH0.0bkefz9UOgRus_LxSANYPipsI9XlhCuU9jZPB2ziydQ";

  const ALLOWED_IP = "222.98.247.233";
  const TABLE_NAME = "SpeedRecord";
  const CLOUDFLARE_TEST_URL = "https://speed.cloudflare.com/__down?bytes=209715200";
  const FAST_TARGETS_URL = `${SUPABASE_URL}/functions/v1/fast-targets`;
  const TEST_DURATION_MS = 15000;
  const MIN_SAMPLE_MS = 5000;
  const PARALLEL_STREAMS = 5;

  const form = document.getElementById("recordForm");
  const speedInput = document.getElementById("speedInput");
  const unitSelect = document.getElementById("unitSelect");
  const saveButton = document.getElementById("saveButton");
  const measureButton = document.getElementById("measureButton");
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
    measureButton.disabled = !enabled;
  }

  function hasSupabaseConfig() {
    return SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
  }

  function toKbps(value, unit) {
    return unit === "mbps" ? value * 1000 : value;
  }

  function setBusy(isBusy) {
    const enabled = !isBusy && isAllowedIp && hasSupabaseConfig();
    setFormEnabled(enabled);
    measureButton.textContent = isBusy ? "측정 중..." : "측정하고 기록하기";
  }

  function addCacheBust(url, index) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}stream=${index}&cacheBust=${Date.now()}`;
  }

  async function getFastTargets() {
    const response = await fetch(FAST_TARGETS_URL, {
      cache: "no-store",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Fast.com 대상 조회 실패: ${response.status}`);
    }

    const data = await response.json();
    const targets = (data.targets || [])
      .map((target) => target.url)
      .filter(Boolean);

    if (targets.length === 0) {
      throw new Error("Fast.com 측정 대상이 없습니다.");
    }

    return targets;
  }

  async function measureDownloadSpeedKbps(targetUrls, onProgress) {
    const startTime = performance.now();
    const urls = targetUrls && targetUrls.length > 0 ? targetUrls : [CLOUDFLARE_TEST_URL];
    let receivedLength = 0;
    let lastProgressAt = 0;

    async function runStream(index) {
      const controller = new AbortController();
      const url = addCacheBust(urls[index % urls.length], index);

      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok || !response.body) {
          throw new Error("속도 측정용 데이터를 받을 수 없습니다.");
        }

        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          receivedLength += value.length;

          const elapsedMs = performance.now() - startTime;
          if (typeof onProgress === "function" && elapsedMs - lastProgressAt >= 700) {
            lastProgressAt = elapsedMs;
            const currentKbps = (receivedLength * 8) / (elapsedMs / 1000) / 1000;
            onProgress(currentKbps, elapsedMs);
          }

          if (elapsedMs >= TEST_DURATION_MS && elapsedMs >= MIN_SAMPLE_MS) {
            await reader.cancel();
            controller.abort();
            break;
          }
        }
      } catch (error) {
        if (error.name !== "AbortError") throw error;
      }
    }

    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL_STREAMS }, (_, index) => runStream(index))
    );

    const failures = results.filter((result) => result.status === "rejected");
    if (receivedLength <= 0 && failures.length > 0) {
      throw failures[0].reason;
    }

    const durationInSeconds = (performance.now() - startTime) / 1000;
    if (durationInSeconds <= 0 || receivedLength <= 0) {
      throw new Error("속도 측정 결과가 올바르지 않습니다.");
    }

    return Number(((receivedLength * 8) / durationInSeconds / 1000).toFixed(2));
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
        accessPanel.textContent = `기록 제한: 현재 IP(${data.ip})는 허용된 IP가 아닙니다. 기존 기록은 볼 수 있습니다.`;
      }
    } catch (error) {
      isAllowedIp = false;
      accessPanel.className = "mb-5 rounded-md border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100";
      accessPanel.textContent = "기록 제한: 접속 IP를 확인할 수 없습니다. 기존 기록은 볼 수 있습니다.";
    }

    setFormEnabled(isAllowedIp && hasSupabaseConfig());
  }

  async function loadRecords() {
    if (!supabaseClient) {
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

  async function insertSpeedRecord(speed) {
    const { error } = await supabaseClient
      .from(TABLE_NAME)
      .insert([{ speed }]);

    if (error) {
      throw error;
    }
  }

  function canRecord() {
    if (!isAllowedIp) {
      setStatus("허용된 IP에서만 기록할 수 있습니다.", "error");
      return false;
    }

    if (!supabaseClient) {
      setStatus("Supabase URL과 Anon Key를 먼저 설정하세요.", "error");
      return false;
    }

    return true;
  }

  async function saveRecord(event) {
    event.preventDefault();

    if (!canRecord()) return;

    const rawSpeed = Number(speedInput.value);
    if (!Number.isFinite(rawSpeed) || rawSpeed <= 0) {
      setStatus("0보다 큰 속도 값을 입력하세요.", "error");
      speedInput.focus();
      return;
    }

    const speed = Number(toKbps(rawSpeed, unitSelect.value).toFixed(2));

    try {
      setBusy(true);
      setStatus("기록 중입니다...", "muted");
      await insertSpeedRecord(speed);
      speedInput.value = "";
      setStatus(`${speed.toLocaleString("ko-KR")} Kbps로 저장했습니다.`, "success");
      await loadRecords();
    } catch (error) {
      setStatus(`저장하지 못했습니다: ${error.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function measureAndRecord() {
    if (!canRecord()) return;

    try {
      setBusy(true);
      setStatus("Fast.com 측정 대상을 가져오는 중입니다...", "muted");

      let targetUrls = [];
      try {
        targetUrls = await getFastTargets();
      } catch (error) {
        setStatus(`Fast.com 대상 조회 실패. Cloudflare로 측정합니다: ${error.message}`, "muted");
      }

      setStatus(`${targetUrls.length > 0 ? "Netflix" : "Cloudflare"} 병렬 다운로드 속도를 측정 중입니다...`, "muted");

      const speed = await measureDownloadSpeedKbps(targetUrls, (currentKbps, elapsedMs) => {
        const seconds = Math.round(elapsedMs / 1000);
        setStatus(`${seconds}초 측정 중... 현재 약 ${currentKbps.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} Kbps`, "muted");
      });

      speedInput.value = speed;
      unitSelect.value = "kbps";

      setStatus(`${speed.toLocaleString("ko-KR")} Kbps 측정 완료. 기록 중입니다...`, "muted");
      await insertSpeedRecord(speed);
      setStatus(`${speed.toLocaleString("ko-KR")} Kbps로 측정하고 저장했습니다.`, "success");
      await loadRecords();
    } catch (error) {
      setStatus(`측정 또는 저장에 실패했습니다: ${error.message}`, "error");
    } finally {
      setBusy(false);
    }
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
  measureButton.addEventListener("click", measureAndRecord);
  init();
})();
