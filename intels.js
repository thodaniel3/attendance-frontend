// intels.js
// CONFIG
const API_URL = "https://attendance-backend-6tmr.onrender.com/api";
const FRONTEND_BASE = "https://attendance-app-rho-rose.vercel.app"; // keep in sync with Render env

// UI helpers
function info(msg) {
  const box = document.getElementById("regResult");
  if (box) box.textContent = msg;
}
function setScanResult(msg, ok = true) {
  const box = document.getElementById('scanResult');
  if (!box) return;
  box.style.color = ok ? '#a8f0b1' : '#ff9a9a';
  box.textContent = msg;
}

// Auto download helper
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
// Registration
// -------------------------------
document.getElementById('regForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.querySelector('[name="name"]').value.trim();
  const username = document.querySelector('[name="username"]').value.trim();
  const email = document.querySelector('[name="email"]').value.trim();
  const matric_number = document.querySelector('[name="matric_number"]').value.trim();
  const photo = document.getElementById("photo").files[0];

  if (!name || !username || !email || !matric_number || !photo) return alert("All fields required");

  const form = new FormData();
  form.append("name", name);
  form.append("username", username);
  form.append("email", email);
  form.append("matric_number", matric_number);
  form.append("photo", photo);

  info("Sending registration...");
  try {
    const res = await fetch(`${API_URL}/student`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok || !data.ok) { alert("Failed: " + (data.error || res.status)); info("Failed"); return; }

    const student = data.student;
    document.getElementById("student-panel").style.display = "block";
    document.getElementById("profile-name").textContent = student.name;
    document.getElementById("profile-matric").textContent = student.matric_number;
    document.getElementById("profile-email").textContent = student.email;
    document.getElementById("profile-photo").src = student.photo_url || '';
    document.getElementById("profile-qr").src = student.qr_code_url || '';

    if (student.qr_code_url) {
      await fetchAndDownload(student.qr_code_url, `${student.name}_QR.png`);
    }
    info("Registration Complete!");
    e.target.reset();
  } catch (err) {
    alert("Registration error: " + err.message);
    info("Error");
  }
});

// -------------------------------
// Attendance helpers (shared)
// -------------------------------
function getQueryParam(name) {
  try { return new URL(window.location.href).searchParams.get(name); } catch { return null; }
}
function getSavedPin() {
  try {
    const pin = localStorage.getItem('lecturer_pin');
    const date = localStorage.getItem('lecturer_pin_date');
    if (!pin || !date) return null;
    return date === new Date().toISOString().slice(0,10) ? pin : null;
  } catch { return null; }
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
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// parse scanned QR value: may be a full URL containing ?id=... or the id itself
function extractStudentIdFromScanned(text) {
  try {
    const u = new URL(text);
    const id = u.searchParams.get('id') || u.searchParams.get('student_id') || null;
    if (id) return id;
    // maybe url path like /scan/<id>
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length && parts[parts.length-1].length >= 8) return parts[parts.length-1];
    return null;
  } catch (e) {
    // not a URL — maybe it's just the id
    if (typeof text === 'string' && text.trim().length > 5) return text.trim();
    return null;
  }
}

// UI overlay used when scan triggers (same UI used by scan?id=... flow)
async function showConfirmAndPost(studentId) {
  // build overlay
  document.body.style.filter = 'blur(2px)';
  const overlay = document.createElement('div');
  overlay.id = 'scan-overlay';
  overlay.style.position = 'fixed';
  overlay.style.left = 0;
  overlay.style.top = 0;
  overlay.style.right = 0;
  overlay.style.bottom = 0;
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.style.zIndex = 9999;
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

  const savedPin = getSavedPin();
  if (savedPin) {
    document.getElementById('scan-pin').value = savedPin;
    document.getElementById('scan-remember').checked = true;
    const lecturerName = localStorage.getItem('lecturer_name') || '';
    if (lecturerName) document.getElementById('scan-lecturer').value = lecturerName;
    setTimeout(() => document.getElementById('scan-submit').click(), 600);
  }

  document.getElementById('scan-cancel').addEventListener('click', () => {
    overlay.remove();
    document.body.style.filter = '';
  });

  document.getElementById('scan-submit').addEventListener('click', async () => {
    const pin = document.getElementById('scan-pin').value.trim();
    const lecturer = document.getElementById('scan-lecturer').value.trim();
    const course = document.getElementById('scan-course').value.trim();
    const remember = document.getElementById('scan-remember').checked;
    const resultBox = document.getElementById('scan-result');

    if (!pin) { resultBox.textContent = 'Please enter PIN.'; return; }
    resultBox.textContent = 'Submitting attendance...';

    const res = await postAttendance(studentId, lecturer, course, pin);
    if (res.ok) {
      resultBox.textContent = '✅ Attendance recorded.';
      if (remember) {
        savePinForToday(pin);
        if (lecturer) localStorage.setItem('lecturer_name', lecturer);
      } else {
        localStorage.removeItem('lecturer_name');
      }
      setTimeout(() => { overlay.remove(); document.body.style.filter = ''; }, 900);
    } else {
      resultBox.textContent = 'Error: ' + (res.error || 'Failed to record attendance.');
    }
  });
}

// If page loaded with scan?id=... show overlay
window.addEventListener('DOMContentLoaded', () => {
  const studentIdFromUrl = getQueryParam('id');
  if (studentIdFromUrl) showConfirmAndPost(studentIdFromUrl);
});

// -------------------------------
// Built-in scanner (html5-qrcode)
// -------------------------------
let html5QrScanner = null;
let scanning = false;

const startBtn = document.getElementById('startScanner');
const stopBtn = document.getElementById('stopScanner');

function startScanner() {
  if (scanning) return;
  const reader = document.getElementById('reader');
  reader.innerHTML = ''; // clear
  html5QrScanner = new Html5Qrcode(/* element id */ "reader");
  Html5Qrcode.getCameras().then(cameras => {
    if (!cameras || cameras.length === 0) {
      setScanResult('No camera found on this device', false);
      return;
    }
    // pick the back camera if available
    const backCamera = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[0];
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrScanner.start(
      { deviceId: { exact: backCamera.id } },
      config,
      onScanSuccess,
      onScanFailure
    ).then(() => {
      scanning = true;
      startBtn.style.display = 'none';
      stopBtn.style.display = 'inline-block';
      setScanResult('Scanner started. Point camera at student QR.');
    }).catch(err => {
      setScanResult('Could not start camera: ' + String(err), false);
    });
  }).catch(err => {
    setScanResult('Error getting cameras: ' + String(err), false);
  });
}

function stopScanner() {
  if (!scanning || !html5QrScanner) return;
  html5QrScanner.stop().then(() => {
    html5QrScanner.clear();
    scanning = false;
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
    setScanResult('Scanner stopped');
  }).catch(err => {
    setScanResult('Failed to stop scanner: ' + String(err), false);
  });
}

function onScanSuccess(decodedText, decodedResult) {
  // Avoid rapid multiple detections
  stopScanner();

  const studentId = extractStudentIdFromScanned(decodedText);
  if (!studentId) {
    setScanResult('Scanned value doesn\'t contain a valid student id', false);
    // restart
    setTimeout(() => startScanner(), 900);
    return;
  }

  setScanResult('Scanned Student ID: ' + studentId);
  // Prompt and post using same overlay
  showConfirmAndPost(studentId);
}

function onScanFailure(error) {
  // ignore frequent errors
  // console.log('scan fail', error);
}

// hook buttons
startBtn?.addEventListener('click', startScanner);
stopBtn?.addEventListener('click', stopScanner);

// Paste URL open
document.getElementById('openUrl')?.addEventListener('click', () => {
  const url = document.getElementById('pasteUrl').value.trim();
  if (!url) return alert('Paste the scan URL from the QR first');
  try {
    // open in same page (will render overlay)
    window.location.href = url;
  } catch (e) {
    alert('Invalid URL');
  }
});
