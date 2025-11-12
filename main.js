const state = {
  height: '0',
  mass: '0',
  showSimulation: false,
  g: 9.8,
  e: 0.7,
  k: 1.2,
  v_i: 0
};

function renderInputView() {
  return `
    <div class="input-view">
      <h1>물리학 시뮬레이션</h1>
      <div class="input-container">
        <h2>시뮬레이션 설정</h2>
        <form id="simulation-form">
          <div class="form-group">
            <label>질량 (kg)</label>
            <div class="input-wrapper">
              <input type="number" id="mass-input" value="${state.mass}" required />
              <span class="unit">kg</span>
            </div>
          </div>

          <div class="form-group">
            <label>초기 높이 (m)</label>
            <div class="input-wrapper">
              <input type="number" id="height-input" value="${state.height}" required />
              <span class="unit">m</span>
            </div>
          </div>

          <div class="constants-box">
            <h3>고정 상수</h3>
            <div class="constant-row">
              <span>중력가속도 (g):</span>
              <span class="value">${state.g} m/s²</span>
            </div>
            <div class="constant-row">
              <span>탄성계수 (e):</span>
              <span class="value">${state.e}</span>
            </div>
            <div class="constant-row">
              <span>항력계수 (k):</span>
              <span class="value">${state.k} kg/s</span>
            </div>
            <div class="constant-row">
              <span>초기 속도 (v<sub>i</sub>):</span>
              <span class="value">${state.v_i} m/s</span>
            </div>
          </div>

          <button type="submit" class="submit-btn">시뮬레이션 실행</button>
        </form>
      </div>
    </div>
  `;
}

function renderSimulationView() {
  return `
    <div class="simulation-view">
      <div class="sidebar">
        <h2>시뮬레이션 설정</h2>

        <div class="form-group">
          <label>질량 (kg)</label>
          <div class="input-wrapper">
            <input type="text" value="${state.mass}" readonly />
            <span class="unit">kg</span>
          </div>
        </div>

        <div class="form-group">
          <label>초기 높이 (m)</label>
          <div class="input-wrapper">
            <input type="text" value="${state.height}" readonly />
            <span class="unit">m</span>
          </div>
        </div>

        <div class="constants-box">
          <h3>고정 상수</h3>
          <div class="constant-row">
            <span>중력가속도 (g):</span>
            <span class="value">${state.g} m/s²</span>
          </div>
          <div class="constant-row">
            <span>탄성계수 (e):</span>
            <span class="value">${state.e}</span>
          </div>
          <div class="constant-row">
            <span>항력계수 (k):</span>
            <span class="value">${state.k} kg/s</span>
          </div>
          <div class="constant-row">
            <span>초기 속도 (v<sub>i</sub>):</span>
            <span class="value">${state.v_i} m/s</span>
          </div>
        </div>

        <button class = "next-btn" id = "next-btn">그래프 보기</button>
        <button class="back-btn" id="back-btn">입력 페이지로 돌아가기</button>
      </div>

      <div class="simulation-content">
        <div class="simulation-container">
          <h2>낙하 시뮬레이션</h2>

          <div class="legend">
            <div class="legend-item">
              <div class="legend-color blue"></div>
              <span>자유낙하</span>
            </div>
            <div class="legend-item">
              <div class="legend-color red"></div>
              <span>항력 포함</span>
            </div>
          </div>

          <div class="canvas-container">
            <div class="canvas-wrapper">
              <canvas id="canvas-freefall" width="300" height="500"></canvas>
              <p>자유낙하</p>
            </div>

            <div class="canvas-wrapper">
              <canvas id="canvas-resistance" width="300" height="500"></canvas>
              <p>항력 포함</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function render() {
  const app = document.getElementById('app');
  if (state.showSimulation) {
    app.innerHTML = renderSimulationView();
    setupSimulation();
    document.getElementById('back-btn').addEventListener('click', () => {
      state.showSimulation = false;
      render();
    });
  } else {
    app.innerHTML = renderInputView();
    document.getElementById('simulation-form').addEventListener('submit', (e) => {
      e.preventDefault();

      let massValue = parseFloat(document.getElementById('mass-input').value);
      let heightValue = parseFloat(document.getElementById('height-input').value);

      if (massValue > 1000) {
        massValue = 1000;
        document.getElementById('mass-input').value = 1000;
      }

      if (massValue < 1) {
        massValue = 1;
        document.getElementById('mass-input').value = 1;
      }

      if (heightValue < 1) {
        heightValue = 1;
        document.getElementById('height-input').value = 1;
      }

      state.mass = document.getElementById('mass-input').value;
      state.height = document.getElementById('height-input').value;
      state.showSimulation = true;
      render();
    });
  }
}

class Simulation {
  constructor(canvas, withAirResistance, color, height, mass, g, e, k, v_i) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ballRadius = 20;
    this.canvasHeight = canvas.height - this.ballRadius;
    this.scale = this.canvasHeight / height;
    this.y = 0;
    this.v = v_i;
    this.e = e;
    this.k = k;
    this.mass = mass;
    this.g = g;
    this.color = color;
    this.withAirResistance = withAirResistance;
    this.lastTime = null;
  }

  update(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    const a = this.withAirResistance
      ? this.g - (this.k / this.mass) * this.v
      : this.g;

    this.v += a * dt;
    this.y += this.v * dt * this.scale;

    if (this.y > this.canvasHeight) {
      this.y = this.canvasHeight;
      this.v = -this.v * this.e;
    }
  }

  drawBackground() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#87CEEB';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBall() {
    this.ctx.beginPath();
    this.ctx.arc(this.canvas.width / 2, this.y, this.ballRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = this.color;
    this.ctx.fill();
    this.ctx.closePath();
  }

  draw() {
    this.drawBackground();
    this.drawBall();
  }
}

let animationId = null;

function setupSimulation() {
  const canvasFreefall = document.getElementById('canvas-freefall');
  const canvasResistance = document.getElementById('canvas-resistance');

  const height = parseFloat(state.height);
  const mass = parseFloat(state.mass);

  const simFreefall = new Simulation(canvasFreefall, false, '#3b82f6', height, mass, state.g, state.e, state.k, state.v_i);
  const simResistance = new Simulation(canvasResistance, true, '#ef4444', height, mass, state.g, state.e, state.k, state.v_i);

  function animate(timestamp) {
    simFreefall.update(timestamp);
    simResistance.update(timestamp);

    simFreefall.draw();
    simResistance.draw();

    animationId = requestAnimationFrame(animate);
  }

  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  animationId = requestAnimationFrame(animate);

  document.getElementById('next-btn').addEventListener('click', () => {
    localStorage.setItem('mass', state.mass);
    localStorage.setItem('height', state.height);
    
    window.location.href = 'index2.html';
  });
}

render();
