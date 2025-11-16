export default class PartOrientationDetector {
  constructor() {
    this.initialized = false;
  }

  async init() {
    if (typeof cv === 'undefined') {
      console.error('OpenCV is not loaded!');
      return;
    }
    this.initialized = true;
    console.log('PartOrientationDetector initialized');
  }

  /**
   * Analyze orientation of a part in the frame.
   * @param {cv.Mat} srcMat - The source image/frame (cv.Mat)
   * @returns {Object} - { angle: Number, rect: cv.RotatedRect, contour: MatVector }
   */
  detectOrientation(srcMat) {
    if (!this.initialized) {
      console.warn('PartOrientationDetector not initialized');
      return null;
    }

    try {
      let gray = new cv.Mat();
      let thresh = new cv.Mat();
      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();

      // Convert to grayscale
      if (srcMat.channels() === 3) {
        cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY, 0);
      } else {
        srcMat.copyTo(gray);
      }

      // Threshold to binary - adjust thresh value if needed
      cv.threshold(gray, thresh, 100, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

      // Find contours
      cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      if (contours.size() === 0) {
        throw new Error('No contours found');
      }

      // Find largest contour by area
      let largestContour = contours.get(0);
      let maxArea = cv.contourArea(largestContour);

      for (let i = 1; i < contours.size(); i++) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        if (area > maxArea) {
          maxArea = area;
          largestContour = cnt;
        }
      }

      // Get rotated rect from largest contour
      let rotatedRect = cv.minAreaRect(largestContour);

      // Angle properties
      let angle = rotatedRect.angle;
      // Angle normalization if needed
      if (rotatedRect.size.width < rotatedRect.size.height) {
        angle = 90 + angle;
      }

      // Clean up
      gray.delete();
      thresh.delete();
      hierarchy.delete();
      contours.delete();

      return {
        angle: angle,
        rect: rotatedRect,
        contour: largestContour
      };

    } catch (err) {
      console.error('Failed to detect orientation:', err);
      return null;
    }
  }
}
