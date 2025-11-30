// car alwaays act like moving sometime really moving 
// stage one only moving in a simple road 
// flappy bird style
// something proove reinforcement learnign
// cloth simulation
//traffic simulation

import {application } from "./app.js";


const app = new application();
// await app.initialize();



let prevTime = 0;
// FPS cap
const MAX_FPS = 60;
const FRAME_DURATION = 1 / MAX_FPS; // ~0.0167s



//------------main render loop --------
function render(time) {
  time *= 0.001; // ms → seconds
  let delta = time - prevTime;

  // Clamp delta so if you tab out, it won’t spike
  if (delta > FRAME_DURATION) delta = FRAME_DURATION;

  // Cap FPS: only update if enough time passed
  if (delta < FRAME_DURATION) {
    requestAnimationFrame(render);
    return;
  }

  prevTime = time;

  app.update(delta);
}

requestAnimationFrame(render);