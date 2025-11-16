// Starts the device camera and continuously copies frames into #cameraCanvas.
// Exposes window.CameraCapture.start() and .stop()

let stream = null;
let rafId = null;

async function startCamera(videoElement = null, canvasElement = null) {
  const video = videoElement || document.getElementById('cameraVideo');
  const canvas = canvasElement || document.getElementById('cameraCanvas');
  if (!video || !canvas) throw new Error('camera elements missing');

  if (stream) return { video, canvas };

  const constraints = { audio: false, video: { facingMode: 'environment' } };
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;

  // wait for metadata so videoWidth/videoHeight are available
  await new Promise((resolve) => {
    if (video.readyState >= 1 && video.videoWidth && video.videoHeight) return resolve();
    const onMeta = () => { video.removeEventListener('loadedmetadata', onMeta); resolve(); };
    video.addEventListener('loadedmetadata', onMeta);
    // fallback timeout
    setTimeout(resolve, 1500);
  });

  await video.play();

  // size canvas to video (use actual video size when available)
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;

  console.log('CameraCapture started', canvas.width, canvas.height);
  const ctx = canvas.getContext('2d');

  function copyFrame() {
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    rafId = requestAnimationFrame(copyFrame);
  }
  copyFrame();

  return { video, canvas };
}

function stopCamera() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

window.CameraCapture = { start: startCamera, stop: stopCamera };

export { startCamera as start, stopCamera as stop };