const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const context = canvas.getContext("2d");

let scanning = true;

// Access back camera
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" } // back camera
    });
    video.srcObject = stream;
    video.setAttribute("playsinline", true);
    video.play();
    requestAnimationFrame(scanQRCode);
  } catch (err) {
    output.textContent = "Error accessing camera: " + err;
  }
}

// Scan QR code continuously
function scanQRCode() {
  if (!scanning) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      const scannedData = code.data.trim();
      output.textContent = "QR Code detected: " + scannedData;

      // If it's a valid URL, open in new tab
      if (isValidUrl(scannedData)) {
        scanning = false; // pause scanning
        window.open(scannedData, "_blank");

        // After 3 seconds, resume scanning automatically
        setTimeout(() => {
          scanning = true;
          output.textContent = "Scan a QR code by pointing your camera at it.";
          requestAnimationFrame(scanQRCode);
        }, 3000);
        return;
      }
    } else {
      output.textContent = "Scanning for QR code...";
    }
  }

  requestAnimationFrame(scanQRCode);
}

// Validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

// Start camera on page load
startCamera();
