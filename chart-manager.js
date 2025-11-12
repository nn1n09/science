// Chart Management Module
class ChartManager {
    constructor() {
        this.heightChart = null;
        this.isInitialized = false;
    }

    // 차트 초기화
    init() {
        if (this.isInitialized) return;

        this.createHeightChart();
        this.isInitialized = true;
    }

    // 높이-시간 차트 생성
    createHeightChart() {
        const ctx = document.getElementById('heightChart');
        if (!ctx) {
            console.error('heightChart canvas not found');
            return;
        }

        this.heightChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: '자유낙하',
                        data: [],
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.1,
                    },
                    {
                        label: '항력 포함',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.1,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                elements: {
                    point: { radius: 0 }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} m`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: '시간 (s)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            stepSize: 1, // 1초 간격 고정
                            callback: function (value) {
                                return value.toFixed(0);
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '높이 (m)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        min: 0,
                        ticks: {
                            callback: function (value) {
                                return value.toFixed(1);
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                animation: {
                    duration: 750,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    // 차트 데이터 업데이트
    updateCharts(results) {
        if (!this.isInitialized) this.init();

        // 높이 차트 데이터 준비
        const freeFallHeightData = results.freeFall.time.map((t, i) => ({
            x: t,
            y: results.freeFall.height[i]
        }));

        const dragHeightData = results.withDrag.time.map((t, i) => ({
            x: t,
            y: results.withDrag.height[i]
        }));

        // 높이 차트 업데이트
        if (this.heightChart) {
            // 완전히 독립적인 데이터셋 할당
            this.heightChart.data.datasets[0].data = [...freeFallHeightData];
            this.heightChart.data.datasets[1].data = [...dragHeightData];
            this.updateHeightChartScaling(results);
            this.heightChart.update('none');
        }
    }

    // 높이 차트 축 스케일링 업데이트
    updateHeightChartScaling(results) {
        if (!this.heightChart) return;

        const maxTime = Math.max(
            Math.max(...results.freeFall.time),
            Math.max(...results.withDrag.time)
        );

        const maxHeight = Math.max(
            Math.max(...results.freeFall.height),
            Math.max(...results.withDrag.height)
        );

        this.heightChart.options.scales.x.max = Math.ceil(maxTime);
        this.heightChart.options.scales.y.max = Math.ceil(maxHeight * 1.1);
    }

    // 차트 초기화
    clearCharts() {
        if (!this.isInitialized) return;

        if (this.heightChart) {
            this.heightChart.data.datasets[0].data = [];
            this.heightChart.data.datasets[1].data = [];
            this.heightChart.update('none');
        }
    }

    downloadChart(chart, filename = 'chart.png') {
        if (!chart) return;
        const link = document.createElement('a');
        link.href = chart.toBase64Image('image/png', 1.0);
        link.download = filename;
        link.click();
    }


    downloadAllCharts() {
        if (this.heightChart)
            this.downloadChart(this.heightChart, 'height_chart.png');
    }

    // 차트 리사이즈
    resize() {
        if (!this.isInitialized) return;

        if (this.heightChart) {
            this.heightChart.resize();
        }
    }

    // 차트 파괴
    destroy() {
        if (this.heightChart) {
            this.heightChart.destroy();
            this.heightChart = null;
        }

        this.isInitialized = false;
    }
}

// 전역 차트 매니저 인스턴스
const chartManager = new ChartManager();

// 다른 모듈에서 사용할 수 있도록 내보내기
if (typeof window !== 'undefined') {
    window.ChartManager = ChartManager;
    window.chartManager = chartManager;
}