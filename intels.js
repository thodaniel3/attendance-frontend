// -------------------------------
// CONFIG
// -------------------------------
const API_URL = "https://attendance-backend-6tmr.onrender.com/api";

// Helper: display messages in registration result box
function info(msg) {
  const box = document.getElementById("regResult");
  if (box) box.textContent = msg;
}

// Helper: fetch a binary file (QR code) and trigger download
async function fetchAndDownload(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch QR image: ${res.status}`);
    const blob = await res.blob();
    const tmpUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = tmpUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(tmpUrl);
  } catch (err) {
    console.warn("QR download failed:", err);
  }
}

// -------------------------------
// REGISTER STUDENT
// -------------------------------
const regForm = document.getElementById("regForm");
if (regForm) {
  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.querySelector('[name="name"]').value.trim();
    const username = document.querySelector('[name="username"]').value.trim();
    const email = document.querySelector('[name="email"]').value.trim();
    const matric_number = document.querySelector('[name="matric_number"]').value.trim();
    const photo = document.getElementById("photo").files[0];

    if (!name || !username || !email || !matric_number || !photo) {
      return alert("All fields + photo are required.");
    }

    const form = new FormData();
    form.append("name", name);
    form.append("username", username);
    form.append("email", email);
    form.append("matric_number", matric_number);
    form.append("photo", photo);

    info("Sending registration...");

    try {
      const res = await fetch(`${API_URL}/student`, {
        method: "POST",
        body: form,
      });

      let data;
      const text = await res.text();
      try { data = JSON.parse(text); } catch { data = { ok: false, error: text || 'Non-JSON response' }; }

      if (!res.ok || !data.ok) {
        alert("Registration failed: " + (data.error || `HTTP ${res.status}`));
        info("Registration failed.");
        return;
      }

      const student = data.student;

      // Populate UI
      document.getElementById("student-panel").style.display = "block";
      document.getElementById("profile-name").textContent = student.name;
      document.getElementById("profile-matric").textContent = student.matric_number;
      document.getElementById("profile-email").textContent = student.email;
      document.getElementById("profile-photo").src = student.photo_url || '';
      document.getElementById("profile-qr").src = student.qr_code_url || '';

      const dl = document.getElementById("btn-download-qr");
      if (student.qr_code_url) {
        dl.href = student.qr_code_url;
        dl.download = (student.name || 'student') + "_QR.png";
        dl.style.display = "inline-block";
        await fetchAndDownload(student.qr_code_url, dl.download);
      } else dl.style.display = "none";

      info("Registration complete!");
      regForm.reset();

    } catch (err) {
      alert("Registration error: " + err.message);
      info("Registration error");
    }
  });
}

// -------------------------------
// SCANNER WITH BACK CAMERA PRIORITY
// -------------------------------
let html5QrCode = null;
let running = false;
const scannedThisSession = new Set();

document.getElementById("startScanner")?.addEventListener("click", async () => {
  try {
    if (running) {
      await html5QrCode.stop();
      running = false;
      document.getElementById("startScanner").textContent = "Start Scanner";
      return;
    }

    html5QrCode = new Html5QrCode("reader");

    // Get all cameras
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras.length) return alert("No camera found");

    // Select back camera if available
    let backCam =
      cameras.find(cam => cam.label.toLowerCase().includes("back")) ||
      cameras[cameras.length - 1]; // fallback (last camera)

    console.log("Selected Camera:", backCam);

    await html5QrCode.start(
      backCam.id,
      { fps: 10, qrbox: 250 },
      async (text) => {
        try {
          let payload;
          try { payload = JSON.parse(text); } catch { throw new Error("QR payload is not JSON"); }
          const id = payload?.id;
          if (!id) throw new Error("QR missing id");

          if (scannedThisSession.has(id)) {
            document.getElementById("scanResult").textContent =
              `Already recorded for id ${id} (this session).`;
            return;
          }
          scannedThisSession.add(id);

          // fetch student
          const stuRes = await fetch(`${API_URL}/student/${id}`);
          if (!stuRes.ok) throw new Error(await stuRes.text() || "Student lookup failed");
          const stuData = await stuRes.json();
          if (!stuData.ok) throw new Error(stuData.error || "Student not found");

          // mark attendance
          const attendanceRes = await fetch(`${API_URL}/attendance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              student_id: id,
              lecturer: document.getElementById("lecturer").value || "Unknown",
              course: document.getElementById("course").value || "Unknown"
            })
          });

          const attData = await attendanceRes.json();
          if (!attData.ok) throw new Error(attData.error || "Attendance failed");

          document.getElementById("scanResult").textContent =
            `Attendance recorded for ${stuData.student.name}`;
        } catch (err) {
          document.getElementById("scanResult").textContent = "Error: " + err.message;
        }
      },
      (err) => {
        // optional error logging
      }
    );

    running = true;
    document.getElementById("startScanner").textContent = "Stop Scanner";

  } catch (err) {
    alert("Scanner error: " + err.message);
  }
});
