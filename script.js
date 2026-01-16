window.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("video");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const statusEl = document.getElementById("status");

  const MODEL_URL =
    "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

  // Detector yang lebih “nangkep” wajah
  const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.5,
  });

  let stream = null;
  let matcher = null;
  let loopTimer = null;
  let running = false;

  function setStatus(t) {
    statusEl.textContent = "Status: " + t;
  }

  async function loadModels() {
    setStatus("loading model...");
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    setStatus("model siap ✅");
  }

  async function startCamera() {
    setStatus("minta izin kamera...");
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    setStatus("kamera nyala ✅");
  }

  async function loadKnownFaces() {
    setStatus("memuat wajah referensi...");

    const users = [
      { label: "a", img: "./known/a.jpg" },
      { label: "b", img: "./known/b.jpg" },
    ];

    const labeled = [];

    for (const u of users) {
      const img = await faceapi.fetchImage(u.img);
      const det = await faceapi
        .detectSingleFace(img, DETECTOR_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!det) {
        console.warn("Wajah tidak terdeteksi di:", u.img);
        continue;
      }

      labeled.push(new faceapi.LabeledFaceDescriptors(u.label, [det.descriptor]));
    }

    if (labeled.length === 0) {
      throw new Error(
        "Tidak ada wajah referensi terbaca. Cek known/a.jpg dan known/b.jpg (harus close-up & terang)."
      );
    }

    // kalau masih susah match: ganti 0.55 jadi 0.6
    matcher = new faceapi.FaceMatcher(labeled, 0.45);
    setStatus("wajah referensi siap ✅");
  }

  function stopAll(reason = "dihentikan") {
    running = false;

    if (loopTimer) {
      clearInterval(loopTimer);
      loopTimer = null;
    }

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    video.srcObject = null;

    startBtn.disabled = false;
    stopBtn.disabled = true;

    setStatus(reason);
  }

  function startLoop() {
    setStatus("arahin wajah ke kamera...");
    running = true;

    loopTimer = setInterval(async () => {
      if (!running) return;

      const det = await faceapi
        .detectSingleFace(video, DETECTOR_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!det) return;

      const best = matcher.findBestMatch(det.descriptor);

      if (best.label !== "unknown") {
        sessionStorage.setItem("verifiedLabel", best.label);
        stopAll("verifikasi berhasil ✅");
        window.location.href = "./letter.html";
      } else {
        setStatus("wajah tidak dikenal ❌");
      }
    }, 900);
  }

  startBtn.addEventListener("click", async () => {
    try {
      startBtn.disabled = true;
      stopBtn.disabled = false;

      sessionStorage.removeItem("verifiedLabel");

      await loadModels();
      await loadKnownFaces();
      await startCamera();
      startLoop();
    } catch (e) {
      console.error(e);
      stopAll("ERROR ❌ (lihat Console F12)");
    }
  });

  stopBtn.addEventListener("click", () => {
    stopAll("dihentikan oleh user.");
  });

  window.addEventListener("beforeunload", () => stopAll("stop"));
});
