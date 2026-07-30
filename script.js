/**
 * VP Operations Command Center - Dashboard Core Controller
 * Handles Data Aggregation & Dynamic Stacked Column Chart Rendering
 */

// 1. Column Mapping Configuration (Adjust index positions if CSV schema changes)
const COL = {
    DATE: 0,
    CENTER: 1,
    REGION: 2,
    ZONE: 3,
    METRIC: 4,
    SUBMETRIC: 5,
    TARGET: 6,
    CAP: 7,
    ACHIEVED: 8,
    METRIC_WEIGHT: 9,
    OVERALL_WEIGHT: 10,
    METRIC_ACH_PCT: 11,
    OVERALL_ACH_PCT: 12,
    BUSINESS_HEAD: 13,
    CENTER_HEAD: 14
};

// Global Store for Data & Chart Tracking
let rawDashboardData = [];
let activeChartInstances = {};

// Safe Initialization on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    try {
        initDashboard();
    } catch (err) {
        console.error("Initialization Error:", err);
    }
});

/**
 * Main Controller Initialization
 */
function initDashboard() {
    // Check if Chart.js library is loaded
    if (typeof Chart === 'undefined') {
        console.error("Chart.js is missing! Make sure Chart.js CDN is included in index.html before script.js.");
        return;
    }

    // Example trigger: replace `sampleData` with your actual fetched CSV / API data array
    if (window.appData && Array.isArray(window.appData)) {
        rawDashboardData = window.appData;
        renderMetricCharts(rawDashboardData);
    } else {
        // Fallback / Initial load listener if data is loaded dynamically
        console.log("Dashboard ready. Pass data to renderMetricCharts(data) when loaded.");
    }
}

/**
 * Renders Stacked Column Charts for Target vs Min/Max Cap vs Achieved
 * @param {Array} dataRows - Raw dataset rows
 */
function renderMetricCharts(dataRows) {
    const container = document.getElementById('charts-container');
    if (!container) {
        console.warn("Chart container '#charts-container' not found in DOM.");
        return;
    }

    // Step 1: Clean up existing Chart instances safely
    destroyAllCharts();
    container.innerHTML = ''; // Reset UI container

    if (!dataRows || !Array.isArray(dataRows) || dataRows.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-slate-400">No data available for the selected filters.</div>`;
        return;
    }

    // Step 2: Aggregate & Group Data by Metric -> Sub-metrics
    const groupedMetrics = processDataForStackedCharts(dataRows);

    // Step 3: Render Card & Stacked Bar Chart for each Metric Group
    Object.keys(groupedMetrics).forEach((metricName, index) => {
        const metricData = groupedMetrics[metricName];
        const submetricLabels = Object.keys(metricData);

        if (submetricLabels.length === 0) return;

        // Create Dashboard Chart Card UI
        const cardContainer = document.createElement('div');
        cardContainer.className = 'chart-card bg-[#1e293b] p-5 rounded-2xl shadow-xl border border-slate-700/60 mb-6 transition-all duration-200 hover:border-slate-600';

        // Card Header
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-4 border-b border-slate-700/50 pb-3';
        header.innerHTML = `
            <div class="flex items-center gap-2.5">
                <span class="w-3 h-3 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50"></span>
                <h3 class="text-base font-bold text-slate-100 tracking-wide">${escapeHtml(metricName)}</h3>
            </div>
            <span class="text-xs font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                Metric & Sub-Metrics Breakdown
            </span>
        `;
        cardContainer.appendChild(header);

        // Canvas Responsive Wrapper
        const canvasWrapper = document.createElement('div');
        canvasWrapper.className = 'relative h-72 w-full';

        const canvas = document.createElement('canvas');
        const canvasId = `chart-canvas-${index}-${metricName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
        canvas.id = canvasId;

        canvasWrapper.appendChild(canvas);
        cardContainer.appendChild(canvasWrapper);
        container.appendChild(cardContainer);

        // Step 4: Extract Data Vectors for Chart Datasets
        const achievedValues = submetricLabels.map(sub => metricData[sub].achieved);
        const capValues = submetricLabels.map(sub => metricData[sub].cap);
        const targetValues = submetricLabels.map(sub => metricData[sub].target);

        // Step 5: Instantiate Chart.js Stacked Bar Chart
        const ctx = canvas.getContext('2d');
        activeChartInstances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: submetricLabels,
                datasets: [
                    {
                        label: 'Achieved',
                        data: achievedValues,
                        backgroundColor: 'rgba(59, 130, 246, 0.85)', // Bright Blue
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        borderRadius: 4,
                        stack: 'PerformanceStack',
                        barPercentage: 0.45
                    },
                    {
                        label: 'Min/Max Cap',
                        data: capValues,
                        backgroundColor: 'rgba(245, 158, 11, 0.85)', // Amber / Orange
                        borderColor: '#f59e0b',
                        borderWidth: 1,
                        borderRadius: 4,
                        stack: 'PerformanceStack',
                        barPercentage: 0.45
                    },
                    {
                        label: 'Target',
                        data: targetValues,
                        backgroundColor: 'rgba(16, 185, 129, 0.85)', // Emerald Green
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4,
                        stack: 'PerformanceStack',
                        barPercentage: 0.45
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 400 },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#cbd5e1',
                            font: { size: 12, family: 'Inter, sans-serif', weight: '500' },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y + '%';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 11, family: 'Inter, sans-serif' }
                        },
                        grid: { display: false }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 11, family: 'Inter, sans-serif' },
                            callback: function (val) {
                                return val + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
    });
}

/**
 * Aggregates & safely parses dataset rows into Metric -> Submetric tree structure
 */
function processDataForStackedCharts(rows) {
    const grouped = {};

    rows.forEach(row => {
        if (!row || !Array.isArray(row)) return;

        // Metric & Submetric values extraction with safe fallbacks
        const rawMetric = row[COL.METRIC];
        const rawSubmetric = row[COL.SUBMETRIC];

        const metric = rawMetric && String(rawMetric).trim() !== '' ? String(rawMetric).trim() : 'General Metrics';
        let submetric = rawSubmetric && String(rawSubmetric).trim() !== '' ? String(rawSubmetric).trim() : 'Overall';

        if (submetric.toLowerCase() === 'none' || submetric === '-') {
            submetric = 'Overall';
        }

        if (!grouped[metric]) {
            grouped[metric] = {};
        }

        if (!grouped[metric][submetric]) {
            grouped[metric][submetric] = { targetSum: 0, capSum: 0, achievedSum: 0, count: 0 };
        }

        // Safe Numeric Parsing
        const target = parseNumber(row[COL.TARGET]);
        const cap = parseNumber(row[COL.CAP]);
        const achieved = parseNumber(row[COL.ACHIEVED]);

        grouped[metric][submetric].targetSum += target;
        grouped[metric][submetric].capSum += cap;
        grouped[metric][submetric].achievedSum += achieved;
        grouped[metric][submetric].count += 1;
    });

    // Calculate normalized averages for display
    const result = {};
    Object.keys(grouped).forEach(metric => {
        result[metric] = {};
        Object.keys(grouped[metric]).forEach(sub => {
            const item = grouped[metric][sub];
            const cnt = item.count > 0 ? item.count : 1;

            result[metric][sub] = {
                target: Number((item.targetSum / cnt).toFixed(1)),
                cap: Number((item.capSum / cnt).toFixed(1)),
                achieved: Number((item.achievedSum / cnt).toFixed(1))
            };
        });
    });

    return result;
}

/**
 * Safe numeric conversion utility
 */
function parseNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    
    // Clean string formatted numbers (e.g. "85%", "1,200")
    const cleaned = String(value).replace(/[%,\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Safe HTML string escape to prevent XSS issues in titles
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Destroys all active Chart.js instances to avoid memory leaks & canvas reuse errors
 */
function destroyAllCharts() {
    Object.keys(activeChartInstances).forEach(id => {
        if (activeChartInstances[id]) {
            activeChartInstances[id].destroy();
        }
    });
    activeChartInstances = {};

    // Fallback cleanup via Chart.js global registry
    if (typeof Chart !== 'undefined' && Chart.instances) {
        Object.keys(Chart.instances).forEach(key => {
            Chart.instances[key].destroy();
        });
    }
}
