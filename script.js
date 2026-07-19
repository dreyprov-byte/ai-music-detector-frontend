// URL бэкенда с живой моделью (Railway)
const API_URL = "https://ai-music-detector-backend-production.up.railway.app";

const fileInput = document.getElementById("fileInput");
const fileButton = document.getElementById("fileButton");
const uploadZone = document.getElementById("uploadZone");
const statusEl = document.getElementById("status");
const loadingEl = document.getElementById("loading");
const resultCard = document.getElementById("resultCard");
const resultFilenameEl = document.getElementById("resultFilename");
const resultLabelEl = document.getElementById("resultLabel");
const resultConfidenceWrap = document.getElementById("resultConfidenceWrap");
const resultConfidenceEl = document.getElementById("resultConfidence");
const probaFillEl = document.getElementById("probaFill");
const resultCommentEl = document.getElementById("resultComment");
const spectrumToggle = document.getElementById("spectrumToggle");
const spectrumArrow = document.getElementById("spectrumArrow");
const spectrumPanel = document.getElementById("spectrumPanel");
const spectrumCanvas = document.getElementById("spectrumCanvas");

// Большая центральная плашка
const resultMainBlock = document.getElementById("resultMainBlock");
const resultLabelBig = document.getElementById("resultLabelBig");

let lastSpectrumData = null;

// Кнопка выбора файла
fileButton.addEventListener("click", () => {
  fileInput.click();
});

// Выбор файла через диалог
fileInput.addEventListener("change", () => {
  if (fileInput.files && fileInput.files[0]) {
    handleFile(fileInput.files[0]);
  }
});

// Drag & drop
uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("dragover");
});

uploadZone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("dragover");
});

uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files && files[0]) {
    handleFile(files[0]);
  }
});

// Главная функция обработки файла
function handleFile(file) {
  // проверяем расширение
  if (!file.name.toLowerCase().endsWith(".mp3")) {
    statusEl.textContent = "Поддерживаются только файлы .mp3";
    return;
  }

  // Сброс UI
  resultCard.style.display = "none";
  resultMainBlock.style.display = "none";
  statusEl.textContent = "Отправляем файл модели…";
  loadingEl.style.display = "flex";
  probaFillEl.style.width = "0%";
  resultConfidenceWrap.style.display = "none";
  resultLabelEl.className = "result-label-pill";
  resultLabelBig.className = "result-label-pill-big";
  resultLabelEl.textContent = "";
  resultLabelBig.textContent = "";
  resultCommentEl.textContent = "";
  spectrumPanel.classList.remove("spectrum-panel-open");
  spectrumArrow.classList.remove("spectrum-arrow-open");

  // Локальный спектр для превью
  loadSpectrumPreview(file);

  const formData = new FormData();
  formData.append("file", file, file.name);

  // Запрос к живой модели на Railway
  fetch(API_URL, {
    method: "POST",
    body: formData,
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      // отрисовать результат
      renderResult(file.name, data);
      statusEl.textContent = "";
    })
    .catch((err) => {
      console.error(err);
      statusEl.textContent = "Ошибка предсказания: " + err.message;
    })
    .finally(() => {
      loadingEl.style.display = "none";
    });
}

// Отрисовка результата из ответа модели
function renderResult(filename, data) {
  // Ожидаем формат: { label: "AI" | "REAL" | "UNSURE", proba_ai: 0.0–1.0 }
  const { label, proba_ai } = data;
  const percent = (proba_ai * 100).toFixed(2);

  resultFilenameEl.textContent = filename;

  // Сброс классов
  resultLabelEl.className = "result-label-pill";
  resultLabelBig.className = "result-label-pill-big";

  let labelText = "";
  let commentText = "";

  if (label === "AI") {
    labelText = "Нейросеть";
    resultLabelEl.classList.add("result-label-ai");
    resultLabelBig.classList.add("result-label-ai");
    commentText =
      proba_ai >= 0.9
        ? "Модель очень уверена, что трек создан нейросетью."
        : "Модель считает, что трек относится к AI‑музыке.";
  } else if (label === "REAL") {
    labelText = "Реальная песня";
    resultLabelEl.classList.add("result-label-real");
    resultLabelBig.classList.add("result-label-real");
    commentText =
      proba_ai <= 0.1
        ? "Модель уверена, что трек создан живым музыкантом."
        : "Модель скорее считает трек реальным.";
  } else {
    labelText = "Сомнительно";
    resultLabelEl.classList.add("result-label-unsure");
    resultLabelBig.classList.add("result-label-unsure");
    commentText =
      "По признакам трек похож и на реальные записи, и на AI‑музыку. Результат стоит трактовать осторожно.";
  }

  resultLabelEl.textContent = labelText;
  resultLabelBig.textContent = labelText;

  probaFillEl.style.width = percent + "%";

  if (proba_ai >= 0.75) {
    resultConfidenceWrap.style.display = "block";
    resultConfidenceEl.textContent = `Уверенность модели: ${percent}%`;
  } else {
    resultConfidenceWrap.style.display = "none";
  }

  resultCommentEl.textContent = commentText;

  // Показываем большую центральную плашку и карточку
  resultMainBlock.style.display = "flex";
  resultCard.style.display = "block";
}

// Спектр — кнопка раскрытия
spectrumToggle.addEventListener("click", () => {
  const isOpen = spectrumPanel.classList.contains("spectrum-panel-open");
  if (isOpen) {
    spectrumPanel.classList.remove("spectrum-panel-open");
    spectrumArrow.classList.remove("spectrum-arrow-open");
  } else {
    spectrumPanel.classList.add("spectrum-panel-open");
    spectrumArrow.classList.add("spectrum-arrow-open");
    drawSpectrum();
  }
});

// Локальный спектр для превью
function loadSpectrumPreview(file) {
  lastSpectrumData = null;
  const reader = new FileReader();
  reader.onload = function (e) {
    const arrayBuffer = e.target.result;
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    audioContext.decodeAudioData(arrayBuffer).then((audioBuffer) => {
      const channelData = audioBuffer.getChannelData(0);
      const sampleCount = Math.min(channelData.length, audioBuffer.sampleRate);
      const segment = channelData.slice(0, sampleCount);

      const fftSize = 512;
      const bins = new Float32Array(fftSize / 2);

      for (let i = 0; i < bins.length; i++) {
        let sum = 0;
        for (let j = i; j < segment.length; j += bins.length) {
          sum += Math.abs(segment[j]);
        }
        bins[i] = sum;
      }

      lastSpectrumData = bins;
      drawSpectrum();
    });
  };
  reader.readAsArrayBuffer(file);
}

// Отрисовка спектра
function drawSpectrum() {
  if (!spectrumCanvas || !lastSpectrumData) return;

  const ctx = spectrumCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = spectrumCanvas.clientWidth;
  const height = spectrumCanvas.clientHeight;

  spectrumCanvas.width = width * dpr;
  spectrumCanvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);

  // фон
  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, 0, width, height);

  // градиент
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, "#22c55e");
  grad.addColorStop(0.5, "#f97316");
  grad.addColorStop(1, "#ef4444");
  ctx.fillStyle = grad;

  const bins = lastSpectrumData;
  const n = bins.length;
  const barWidth = width / n;
  const maxValue = Math.max(...bins) || 1;

  for (let i = 0; i < n; i++) {
    const v = bins[i] / maxValue;
    const barHeight = v * (height - 6);
    const x = i * barWidth;
    const y = height - barHeight;

    ctx.fillRect(x, y, Math.max(barWidth - 1, 1), barHeight);
  }
}
