// BuildXR - XR Assembly Assistant
// Main entry point for the application

import { application } from "./app.js";

// Create the application instance
const app = new application();

// Start the render loop (uses setAnimationLoop for VR compatibility)
app.startRenderLoop();