// Simple ES module that loads OpenCV.js and exposes window.cvReady Promise

const OPENCV_URL = 'https://docs.opencv.org/4.x/opencv.js'; // fallback CDN

// create a promise that resolves when cv is ready
if (!window.cvReady) {
  window.cvReady = new Promise((resolve, reject) => {
    // If opencv already present
    if (window.cv && window.cv.onRuntimeInitialized) {
      window.cv.onRuntimeInitialized = () => resolve(window.cv);
      return;
    }

    // inject script
    const s = document.createElement('script');
    s.src = OPENCV_URL;
    s.async = true;
    s.onload = () => {
      // wait for onRuntimeInitialized
      if (window.cv && window.cv.onRuntimeInitialized) {
        window.cv['onRuntimeInitialized'] = () => {
          console.log('OpenCV loaded');
          resolve(window.cv);
        };
      } else {
        // some builds may initialize immediately
        if (window.cv) {
          resolve(window.cv);
        } else {
          reject(new Error('OpenCV failed to initialize'));
        }
      }
    };
    s.onerror = (err) => reject(err);
    document.head.appendChild(s);
  });
}

export { };