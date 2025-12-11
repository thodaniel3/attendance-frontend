// -------------------------------
// CONFIG
// -------------------------------
const API_URL = "https://attendance-backend-6tmr.onrender.com/api";
const FRONTEND_BASE = "https://attendance-app-rho-rose.vercel.app"; // your frontend URL

// Helper: display messages
function info(msg) {
  const box = document.getElementById("regResult");
  if (box) box.textContent = msg;
}

// Helper: Auto download QR code (unchanged)
async function fetchAndDownload(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch QR image: ${res.status}`);
    const blob = await res.blob();
    const tempUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = tempUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(tempUrl);
  } catch (err) {
    console.warn("QR download failed:", err);
  }
}

// -------------------------------
// REGISTER STUDENT (unchanged, still works)
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
      return alert("All fields including photo are required.");
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

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { ok: false, error: text }; }

      if (!res.ok || !data.ok) {
        alert("Registration failed: " + (data.error || `HTTP ${res.status}`));
        info("Registration failed.");
        return;
      }

      const student = data.student;

      // Show profile
      document.getElementById("student-panel").style.display = "block";
      document.getElementById("profile-name").textContent = student.name;
      document.getElementById("profile-matric").textContent = student.matric_number;
      document.getElementById("profile-email").textContent = student.email;
      document.getElementById("profile-photo").src = student.photo_url || '';
      document.getElementById("profile-qr").src = student.qr_code_url || '';

      // Auto download QR image (if present)
      if (student.qr_code_url) {
        await fetchAndDownload(student.qr_code_url, `${student.name}_QR.png`);
      }

      info("Registration Complete!");
      regForm.reset();

    } catch (err) {
      alert("Registration error: " + err.message);
      info("Registration error");
    }
  });
}

// -------------------------------
// SCAN VIA URL (for third-party scanner opens /scan?id=...)
// -------------------------------

// Helper: read query param
function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

// Helper: check saved PIN (remember for day)
function getSavedPin() {
  try {
    const pin = localStorage.getItem('lecturer_pin');
    const date = localStorage.getItem('lecturer_pin_date');
    if (!pin || !date) return null;
    const today = new Date().toISOString().slice(0,10);
    return date === today ? pin : null;
  } catch {
    return null;
  }
}
function savePinForToday(pin) {
  try {
    localStorage.setItem('lecturer_pin', pin);
    localStorage.setItem('lecturer_pin_date', new Date().toISOString().slice(0,10));
  } catch {}
}

async function postAttendance(studentId, lecturerName, courseCode, pin) {
  try {
    const res = await fetch(`${API_URL}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        lecturer: lecturerName || 'Unknown',
        course: courseCode || 'Unknown',
        admin_pin: pin
      })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Build a tiny UI overlay when visit /scan?id=...
function createScanUi(studentId) {
  // hide main page content so lecturer sees scan UI clearly
  document.body.style.filter = 'blur(2px)'; // subtle hint; will restore below
  const overlay = document.createElement('div');
  overlay.id = 'scan-overlay';
  overlay.style.position = 'fixed';
  overlay.style.left = '0';
  overlay.style.top = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '20px';
  overlay.innerHTML = `
    <div style="max-width:420px;width:100%;background:#111;padding:18px;border-radius:10px;border:1px solid #333;color:#fff;">
      <h3 style="margin-top:0;text-align:center;color:#d4af37">Confirm Attendance</h3>
      <p id="scan-msg">Student ID: <strong>${studentId}</strong></p>
      <input id="scan-lecturer" placeholder="Lecturer Name" style="width:100%;padding:10px;margin-top:8px;border-radius:6px;border:1px solid #444;background:#222;color:#ddd">
      <input id="scan-course" placeholder="Course Code" style="width:100%;padding:10px;margin-top:8px;border-radius:6px;border:1px solid #444;background:#222;color:#ddd">
      <input id="scan-pin" placeholder="Enter secret PIN" type="password" style="width:100%;padding:10px;margin-top:8px;border-radius:6px;border:1px solid #444;background:#222;color:#ddd">
      <label style="display:flex;align-items:center;margin-top:8px;color:#ddd">
        <input id="scan-remember" type="checkbox" style="margin-right:8px"> Remember PIN for today
      </label>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button id="scan-submit" style="flex:1;padding:10px;background:#5c3a23;border-radius:6px;border:none;color:#fff;cursor:pointer">Submit</button>
        <button id="scan-cancel" style="flex:1;padding:10px;background:#444;border-radius:6px;border:none;color:#fff;cursor:pointer">Cancel</button>
      </div>
      <p id="scan-result" style="margin-top:12px;color:#ddd"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  // If saved pin exists, auto-fill and submit
  const savedPin = getSavedPin();
  if (savedPin) {
    document.getElementById('scan-pin').value = savedPin;
    document.getElementById('scan-remember').checked = true;
    // optionally auto-fill lecturer name from localStorage (if stored)
    const lecturerName = localStorage.getItem('lecturer_name') || '';
    if (lecturerName) document.getElementById('scan-lecturer').value = lecturerName;
    // auto submit after short delay
    setTimeout(() => document.getElementById('scan-submit').click(), 700);
  }

  document.getElementById('scan-cancel').addEventListener('click', () => {
    document.getElementById('scan-overlay')?.remove();
    document.body.style.filter = '';
  });

  document.getElementById('scan-submit').addEventListener('click', async () => {
    const pin = document.getElementById('scan-pin').value.trim();
    const lecturerName = document.getElementById('scan-lecturer').value.trim();
    const courseCode = document.getElementById('scan-course').value.trim();
    const remember = document.getElementById('scan-remember').checked;
    const resultBox = document.getElementById('scan-result');

    if (!pin) {
      resultBox.textContent = 'Please enter PIN.';
      return;
    }

    resultBox.textContent = 'Submitting attendance...';

    // attempt to post attendance
    const res = await postAttendance(studentId, lecturerName, courseCode, pin);
    if (res.ok) {
      resultBox.textContent = '✅ Attendance recorded. Thank you.';
      // remember pin/lecturer if requested
      if (remember) {
        savePinForToday(pin);
        if (lecturerName) localStorage.setItem('lecturer_name', lecturerName);
      } else {
        // if not remember, clear any stored name
        localStorage.removeItem('lecturer_name');
      }
      // small delay then close overlay
      setTimeout(() => {
        document.getElementById('scan-overlay')?.remove();
        document.body.style.filter = '';
      }, 900);
    } else {
      resultBox.textContent = 'Error: ' + (res.error || 'Failed to record attendance.');
    }
  });
}

// On load: if url contains id param, show scan UI and attempt auto-submit if pin saved
window.addEventListener('DOMContentLoaded', () => {
  const studentId = getQueryParam('id');
  if (studentId) {
    createScanUi(studentId);
  }
});

// -------------------------------
// (Optional) Keep your in-page scanner too (unchanged) if you want — not required anymore
// -------------------------------
