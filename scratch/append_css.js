const fs = require('fs');

const css = `
/* ========================================================
   Celebration Modal & Confetti Styles
   ======================================================== */

.celebration-modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.5s ease, visibility 0.5s ease;
}

.celebration-modal-overlay.active {
  opacity: 1;
  visibility: visible;
}

.celebration-modal {
  background: linear-gradient(135deg, #ffffff, #f3e8ff);
  border-radius: 24px;
  padding: 40px;
  max-width: 500px;
  width: 90%;
  text-align: center;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  transform: scale(0.8) translateY(30px);
  opacity: 0;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease;
  position: relative;
  overflow: hidden;
}

.celebration-modal-overlay.active .celebration-modal {
  transform: scale(1) translateY(0);
  opacity: 1;
}

.celebration-title {
  font-size: 2.2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #a855f7, #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 20px;
  margin-top: 10px;
  line-height: 1.2;
}

.celebration-body {
  font-size: 1.1rem;
  color: #4b5563;
  line-height: 1.6;
  margin-bottom: 30px;
}

.celebration-btn {
  background: linear-gradient(135deg, #a855f7, #d946ef);
  color: white;
  border: none;
  padding: 14px 32px;
  border-radius: 50px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 20px -5px rgba(168, 85, 247, 0.4);
  transition: all 0.3s ease;
}

.celebration-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 25px -5px rgba(168, 85, 247, 0.5);
}

.confetti-canvas {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 10001;
}

[data-theme="dark"] .celebration-modal {
  background: linear-gradient(135deg, #1f2937, #3b0764);
}
[data-theme="dark"] .celebration-body {
  color: #d1d5db;
}
`;

fs.appendFileSync('styles.css', css);
console.log('Appended CSS to styles.css');
