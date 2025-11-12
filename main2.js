// Main Application Controller
class PhysicsSimulationApp {
    constructor() {
        this.worker = null;
        this.currentResults = null;
        this.isSimulating = false;

        this.initializeWorker();
        this.bindEventListeners();
        this.initializeCharts();
    }

    // Web Worker 초기화
    initializeWorker() {
        try {
            // sim.worker.js를 직접 로드하는 대신 인라인으로 생성 (안정성 및 단일 파일 유지)
            const workerCode = `
                // Physics Simulation Web Worker
                class PhysicsSimulator {
                    constructor() {
                        // 고정 상수들
                        this.g = 9.8     ;      // 중력가속도 (m/s²)
                        this.e = 0.7;       // 탄성계수
                        this.k = 1.2;       // 항력계수 (kg/s)
                        this.v0 = 0;        // 초기 속도 (m/s)
                        this.dt = 0.01;     // 시간 간격 (s)
                        this.T_max = 60;    // 최대 시뮬레이션 시간 (s)
                        this.v_stop = 0.05; // 정지 판정 속도 임계값 (m/s)
                    }

                    // RK4 수치적분 방법
                    rk4Step(y, v, dt, mass, useDrag) {
                        const k1v = this.acceleration(v, mass, useDrag);
                        const k1y = v;
                        
                        const k2v = this.acceleration(v + 0.5 * dt * k1v, mass, useDrag);
                        const k2y = v + 0.5 * dt * k1v;
                        
                        const k3v = this.acceleration(v + 0.5 * dt * k2v, mass, useDrag);
                        const k3y = v + 0.5 * dt * k2v;
                        
                        const k4v = this.acceleration(v + dt * k3v, mass, useDrag);
                        const k4y = v + dt * k3v;
                        
                        const newV = v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
                        const newY = y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
                        
                        return { y: newY, v: newV };
                    }

                    // 가속도 계산
                    acceleration(v, mass, useDrag) {
                        if (useDrag) {
                            return -this.g - (this.k * v) / mass;
                        } else {
                            return -this.g; // 자유낙하
                        }
                    }

                    // 바운스 처리 (선형 보간으로 정확한 접지 시점 계산)
                    handleBounce(y, v, y_prev, v_prev, dt) {
                        if (y <= 0 && v < 0) {
                            // 선형 보간으로 정확한 접지 시점 찾기
                            const t_impact = -y_prev / (y - y_prev);
                            const v_impact = v_prev + t_impact * (v - v_prev);
                            
                            return {
                                y: 0,
                                v: -this.e * v_impact,
                                bounced: true,
                                impactTime: t_impact * dt
                            };
                        }
                        return { y, v, bounced: false, impactTime: 0 };
                    }

                    // 정지 조건 확인
                    isAtRest(y, v) {
                        return Math.abs(y) < 1e-6 && Math.abs(v) < this.v_stop;
                    }

                    // 메인 시뮬레이션 함수
                    simulate(params) {
                        const { mass, height } = params;
                        
                        const results = {
                            freeFall: { time: [], height: [], velocity: [] },
                            withDrag: { time: [], height: [], velocity: [] },
                            metadata: { 
                                totalPoints: 0, 
                                endTime: 0,
                                freeFallBounces: 0,
                                dragBounces: 0,
                                freeFallStopped: false,
                                dragStopped: false
                            }
                        };

                        // 초기 조건
                        let freeFallState = { y: height, v: this.v0 };
                        let dragState = { y: height, v: this.v0 };
                        let freeFallBounces = 0;
                        let dragBounces = 0;
                        let freeFallStopped = false;
                        let dragStopped = false;

                        const steps = Math.ceil(this.T_max / this.dt);
                        let progressCounter = 0;

                        // 시뮬레이션 루프
                        for (let i = 0; i <= steps; i++) {
                            const t = i * this.dt;
                            
                            // 현재 상태 저장
                            results.freeFall.time.push(t);
                            results.freeFall.height.push(Math.max(0, freeFallState.y));
                            results.freeFall.velocity.push(freeFallState.v);
                            
                            results.withDrag.time.push(t);
                            results.withDrag.height.push(Math.max(0, dragState.y));
                            results.withDrag.velocity.push(dragState.v);
                            
                            // 진행률 보고 (매 100 스텝마다)
                            if (progressCounter % 100 === 0) {
                                self.postMessage({
                                    type: 'progress',
                                    progress: (i / steps) * 100,
                                    currentTime: t
                                });
                            }
                            progressCounter++;

                            // 두 모델 모두 정지했으면 종료
                            if (freeFallStopped && dragStopped) {
                                results.metadata.endTime = t;
                                break;
                            }

                            // 최대 시간 도달 시 종료
                            if (t >= this.T_max) {
                                results.metadata.endTime = this.T_max;
                                break;
                            }

                            // 자유낙하 업데이트
                            if (!freeFallStopped) {
                                const prevState = { y: freeFallState.y, v: freeFallState.v };
                                const nextState = this.rk4Step(
                                    freeFallState.y, 
                                    freeFallState.v, 
                                    this.dt, 
                                    mass, 
                                    false
                                );
                                
                                const bounceResult = this.handleBounce(
                                    nextState.y, 
                                    nextState.v, 
                                    prevState.y, 
                                    prevState.v, 
                                    this.dt
                                );
                                
                                freeFallState.y = bounceResult.y;
                                freeFallState.v = bounceResult.v;
                                
                                if (bounceResult.bounced) {
                                    freeFallBounces++;
                                }

                                // 정지 조건 확인
                                if (this.isAtRest(freeFallState.y, freeFallState.v)) {
                                    freeFallStopped = true;
                                }
                            }
                            
                            // 항력 포함 모델 업데이트
                            if (!dragStopped) {
                                const prevState = { y: dragState.y, v: dragState.v };
                                const nextState = this.rk4Step(
                                    dragState.y, 
                                    dragState.v, 
                                    this.dt, 
                                    mass, 
                                    true
                                );
                                
                                const bounceResult = this.handleBounce(
                                    nextState.y, 
                                    nextState.v, 
                                    prevState.y, 
                                    prevState.v, 
                                    this.dt
                                );
                                
                                dragState.y = bounceResult.y;
                                dragState.v = bounceResult.v;
                                
                                if (bounceResult.bounced) {
                                    dragBounces++;
                                }

                                // 정지 조건 확인
                                if (this.isAtRest(dragState.y, dragState.v)) {
                                    dragStopped = true;
                                }
                            }
                        }

                        // 메타데이터 업데이트
                        results.metadata.totalPoints = results.freeFall.time.length;
                        results.metadata.freeFallBounces = freeFallBounces;
                        results.metadata.dragBounces = dragBounces;
                        results.metadata.freeFallStopped = freeFallStopped;
                        results.metadata.dragStopped = dragStopped;

                        return results;
                    }

                    // 입력 매개변수 검증
                    validateParameters(params) {
                        const errors = [];
                        
                        if (!params.mass || params.mass <= 0) {
                            errors.push('질량은 0보다 큰 값이어야 합니다.');
                        }
                        
                        if (params.mass > 1000) {
                            errors.push('질량은 1000kg 이하여야 합니다.');
                        }
                        
                        if (params.height < 0) {
                            errors.push('초기 높이는 0 이상이어야 합니다.');
                        }
                        
                        if (params.height > 1000) {
                            errors.push('초기 높이는 1000m 이하여야 합니다.');
                        }
                        
                        return {
                            isValid: errors.length === 0,
                            errors: errors
                        };
                    }
                }

                // Web Worker 메시지 핸들러
                self.onmessage = function(e) {
                    const { type, params } = e.data;
                    
                    switch (type) {
                        case 'simulate':
                            try {
                                self.postMessage({ type: 'status', message: '시뮬레이션 시작...' });
                                
                                const simulator = new PhysicsSimulator();
                                
                                // 매개변수 검증
                                const validation = simulator.validateParameters(params);
                                if (!validation.isValid) {
                                    self.postMessage({ 
                                        type: 'error', 
                                        message: \`입력값 오류: \${validation.errors.join(', ')}\` 
                                    });
                                    return;
                                }
                                
                                const results = simulator.simulate(params);
                                
                                self.postMessage({ 
                                    type: 'complete', 
                                    results: results 
                                });
                                
                            } catch (error) {
                                self.postMessage({ 
                                    type: 'error', 
                                    message: \`계산 오류: \${error.message}\` 
                                });
                            }
                            break;
                            
                        default:
                            self.postMessage({
                                type: 'error',
                                message: \`알 수 없는 명령: \${type}\`
                            });
                    }
                };

                // 초기화 메시지
                self.postMessage({ 
                    type: 'ready', 
                    message: 'Physics Worker initialized successfully' 
                });
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.worker = new Worker(URL.createObjectURL(blob));

            this.worker.onmessage = (e) => this.handleWorkerMessage(e);
            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                this.showToast('계산 워커 오류가 발생했습니다.', 'error');
                this.hideLoadingOverlay();
            };
        } catch (error) {
            console.error('Failed to initialize worker:', error);
            this.showToast('웹 워커 초기화에 실패했습니다.', 'error');
        }
    }

    // Worker 메시지 처리
    handleWorkerMessage(e) {
        const { type, results, message, progress, currentTime } = e.data;

        switch (type) {
            case 'ready':
                console.log('Physics worker ready');
                break;

            case 'status':
                // status 메시지는 현재 사용하지 않으므로 무시
                break;

            case 'progress':
                this.updateProgress(progress, currentTime);
                break;

            case 'complete':
                this.handleSimulationComplete(results);
                break;

            case 'error':
                this.handleSimulationError(message);
                break;
        }
    }

    // 이벤트 리스너 바인딩
    bindEventListeners() {
        // 실행 버튼
        const runBtn = document.getElementById('runBtn');
        if (runBtn) {
            runBtn.addEventListener('click', (e) => {
                e.preventDefault(); // 기본 폼 동작 막기

                window.location.href = "index.html";
            });
        }

        // 폼 제출 이벤트 (Enter 키 등)
        const controlsForm = document.getElementById('controlsForm');
        if (controlsForm) {
            controlsForm.addEventListener('submit', (e) => {
                e.preventDefault(); // 기본 폼 제출 방지
                this.runSimulation();
            });
        }

        const downloadBtn = document.getElementById('downloadChartBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (window.chartManager) {
                    window.chartManager.downloadAllCharts();
                }
            });
        }

        // 입력 필드 검증 (참고: readonly지만 값은 코드로 설정됨)
        const massInput = document.getElementById('massInput');
        const heightInput = document.getElementById('heightInput');

        if (massInput) {
            massInput.addEventListener('input', () => {
                this.validateInput('mass', massInput.value);
            });
        }

        if (heightInput) {
            heightInput.addEventListener('input', () => {
                this.validateInput('height', heightInput.value);
            });
        }

        // 윈도우 리사이즈 핸들러
        window.addEventListener('resize', () => {
            if (window.chartManager) {
                window.chartManager.resize();
            }
        });

        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.runSimulation();
            }
        });
    }

    // 차트 초기화
    initializeCharts() {
        if (window.chartManager) {
            window.chartManager.init();
        }
    }

    // 입력값 검증
    validateInput(type, value) {
        const numValue = parseFloat(value);
        let errorElement, isValid = true, errorMessage = '';

        if (type === 'mass') {
            errorElement = document.getElementById('massError');
            if (isNaN(numValue) || numValue <= 0) {
                isValid = false;
                errorMessage = '질량은 0보다 큰 값이어야 합니다.';
            } else if (numValue > 1000) {
                isValid = false;
                errorMessage = '질량은 1000kg 이하여야 합니다.';
            }
        } else if (type === 'height') {
            errorElement = document.getElementById('heightError');
            if (isNaN(numValue) || numValue < 0) {
                isValid = false;
                errorMessage = '초기 높이는 0 이상이어야 합니다.';
            } else if (numValue > 1000) {
                isValid = false;
                errorMessage = '초기 높이는 1000m 이하여야 합니다.';
            }
        }

        if (errorElement) {
            errorElement.textContent = errorMessage;
            errorElement.style.display = isValid ? 'none' : 'block';
        }

        return isValid;
    }

    // 현재 매개변수 가져오기
    getCurrentParameters() {
        const massInput = document.getElementById('massInput');
        const heightInput = document.getElementById('heightInput');

        return {
            mass: parseFloat(massInput?.value || 70),
            height: parseFloat(heightInput?.value || 10)
        };
    }

    // 시뮬레이션 실행
    async runSimulation() {
        if (this.isSimulating) {
            this.showToast('시뮬레이션이 이미 실행 중입니다.', 'info');
            return;
        }

        const params = this.getCurrentParameters();

        // 입력값 검증
        const massValid = this.validateInput('mass', params.mass);
        const heightValid = this.validateInput('height', params.height);

        if (!massValid || !heightValid) {
            this.showToast('입력값을 확인해주세요.', 'error');
            return;
        }

        this.isSimulating = true;
        this.showLoadingOverlay();
        this.clearCharts();

        try {
            // Worker에 시뮬레이션 요청
            this.worker.postMessage({
                type: 'simulate',
                params: params
            });
        } catch (error) {
            this.handleSimulationError(`시뮬레이션 시작 실패: ${error.message}`);
        }
    }

    // 시뮬레이션 완료 처리
    handleSimulationComplete(results) {
        this.isSimulating = false;
        this.currentResults = results;
        this.hideLoadingOverlay();

        // 차트 업데이트
        if (window.chartManager) {
            window.chartManager.updateCharts(results);
        }

        this.showToast('시뮬레이션이 완료되었습니다.', 'success');
    }

    // 시뮬레이션 오류 처리
    handleSimulationError(message) {
        this.isSimulating = false;
        this.hideLoadingOverlay();
        this.showToast(message, 'error');
    }

    // 진행률 업데이트
    updateProgress(progress, currentTime) {
        // 필요시 진행률 표시 로직 추가 (예: 로딩 오버레이에 텍스트 업데이트)
    }

    // 차트 초기화
    clearCharts() {
        if (window.chartManager) {
            window.chartManager.clearCharts();
        }
    }

    // 로딩 오버레이 표시
    showLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    // 로딩 오버레이 숨기기
    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    // 토스트 알림 표시
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // 5초 후 자동 제거
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);

        // 클릭 시 제거
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }

    // 리소스 정리
    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }

        if (window.chartManager) {
            window.chartManager.destroy();
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // 1. 앱 인스턴스 생성
    const app = new PhysicsSimulationApp();

    // 2. localStorage에서 파라미터 값 가져오기
    // index.html의 main.js에서 값을 저장할 때 localStorage.setItem("mass", mass); 형태로 저장했다고 가정
    const mass = localStorage.getItem("mass");
    const height = localStorage.getItem("height");

    const massInput = document.getElementById("massInput");
    const heightInput = document.getElementById("heightInput");

    // 3. 입력 필드에 값 설정
    if (mass && height && massInput && heightInput) {
        massInput.value = mass;
        heightInput.value = height;
    } else {
        // 값이 없을 경우 기본값(70kg, 100m)을 사용하도록 input 태그에 이미 설정되어 있음
        console.warn("⚠️ main.js에서 전달된 데이터가 없어 기본값을 사용합니다.");
    }

    // UI가 값을 반영할 시간을 주기 위해 짧은 지연(timeout) 후 실행
    setTimeout(() => {
        app.runSimulation();
    }, 100); // 0.1초 후 자동 실행
});