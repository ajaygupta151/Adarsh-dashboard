/**
 * VP Operations Command Center - Stacked Column Dashboard Controller
 */

// Dataset Index Column Definition
const COL = {
    DATE: 0,
    CENTER: 1,
    REGION: 2,
    ZONE: 3,
    METRIC: 4,
    SUBMETRIC: 5,
    TARGET: 6,
    CAP: 7,
    ACHIEVED: 8
};

// Tracking active Chart instances
let activeCharts = {};

// Default Fallback Sample Data (Ensures dashboard loads even before API/CSV is attached)
const defaultDashboardData = [
    // Admissions AY26
    ["2026-07-20", "Center A", "North", "Zone 1", "Admissions AY26", "Overall", 60, 10, 52],
    ["2026-07-20", "Center A", "North", "Zone 1", "Admissions AY26", "Sub: C2", 55, 15, 48],
    
    // Attendance
    ["2026-07-20", "Center A", "North", "Zone 1", "Attendance", "Overall Attendance", 80, 5, 72],
    ["2026-07-20", "Center A", "North", "Zone 1", "Attendance", "Sub: DAS", 85, 5, 78],
    ["2026-07-20", "Center A", "North", "Zone 1", "Attendance", "Sub: Inactivity", 15, 5, 10],

    // EMI Collection
    ["2026-07-20", "Center A", "North", "Zone 1", "EMI Collection", "Overall EMI", 90, 5, 82],
    ["2026-07-20", "Center A", "North", "Zone 1", "EMI Collection", "Sub: Overdue", 20, 10, 14],

    // Test Performance
    ["2026-07-20", "Center A", "North", "Zone 1", "Test Performance and Attendance", "Overall Performance", 75, 5, 68],
    ["2026-07-20", "Center A", "North", "Zone 1", "Test Performance and Attendance", "Sub: Attempt Rate", 85, 10, 80]
];

// Load on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    refreshDashboard();
});

function refreshDashboard() {
    const dataToRender = window.dashboardData || defaultDashboardData;
    renderMetricCharts(dataToRender);
}

function renderMetricCharts(rows) {
    const container = document.getElementById('charts-container');
    if (!container) {
        console.error("Error: Container '#charts-container' missing from index.html");
        return;
    }

    // Safely clear old charts
    destroyCharts();
    container.innerHTML = '';

    if (!rows || rows.length === 0) {
        container.innerHTML = `<p class="col-span-2 text-center text-slate-400 py-8">No records available to display.</p>`;
        return;
    }

    // Group dataset by Metric -> Submetric
    const grouped = processMetricsData(rows);

    // Build stacked charts per primary Metric
    Object.keys(grouped).forEach((metricName, idx) => {
        const metricObj = grouped[metricName];
        const submetricLabels = Object.keys(metricObj);

        // Card Wrapper
        const card = document.createElement('div');
        card.className = 'chart-card bg-[#1e293b] p-5 rounded-2xl border border-slate-700/80 shadow-lg';

        // Title
        card.innerHTML = `
            <div class="flex items-center justify-between mb-4 border-b border-slate-700/50 pb-3">
                <h3 class="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    ${metricName}
                </h3>
                <span class="text-[11px] text-slate-400">Target vs Cap vs Achieved</span>
            </div>
            <div class="relative h-64 w-full">
                <canvas id="canvas-metric-${idx}"></canvas>
            </div>
        `;
        container.appendChild(card);

        // Dataset arrays
        const targetVals = submetricLabels.map(sub => metricObj[sub].target);
        const capVals = submetricLabels.map(sub => metricObj[sub].cap);
        const achievedVals = submetricLabels.map(sub => metricObj[sub].achieved);

        // Render Stacked Bar Chart
        const canvas = document.getElementById(`canvas-metric-${idx}`);
        const ctx = canvas.getContext('2d');

        activeCharts[`canvas-metric-${idx}`] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: submetricLabels,
                datasets: [
                    {
                        label: 'Achieved (%)',
                        data: achievedVals,
                        backgroundColor: '#3b82f6', // Blue
                        stack: 'MetricStack',
                        barPercentage: 0.5
                    },
                    {
                        label: 'Min/Max Cap (%)',
                        data: capVals,
                        backgroundColor: '#f59e0b', // Amber
                        stack: 'MetricStack',
                        barPercentage: 0.5
                    },
                    {
                        label: 'Target (%)',
                        data: targetVals,
                        backgroundColor: '#10b981', // Green
                        stack: 'MetricStack',
                        barPercentage: 0.5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', font: { size: 11 }, usePointStyle: true }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%`
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: '#94a3b8', font: { size: 10 } },
                        grid: { display: false }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 10 },
                            callback: (val) => `${val}%`
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    }
                }
            }
        });
    });
}

function processMetricsData(rows) {
    const grouped = {};

    rows.forEach(row => {
        const metric = row[COL.METRIC] || 'General Metric';
        const submetric = row[COL.SUBMETRIC] || 'Overall';

        if (!grouped[metric]) grouped[metric] = {};
        if (!grouped[metric][submetric]) {
            grouped[metric][submetric] = { target: 0, cap: 0, achieved: 0, count: 0 };
        }

        grouped[metric][submetric].target += parseFloat(row[COL.TARGET]) || 0;
        grouped[metric][submetric].cap += parseFloat(row[COL.CAP]) || 0;
        grouped[metric][submetric].achieved += parseFloat(row[COL.ACHIEVED]) || 0;
        grouped[metric][submetric].count += 1;
    });

    // Averaging values
    Object.keys(grouped).forEach(m => {
        Object.keys(grouped[m]).forEach(s => {
            const cnt = grouped[m][s].count || 1;
            grouped[m][s].target = +(grouped[m][s].target / cnt).toFixed(1);
            grouped[m][s].cap = +(grouped[m][s].cap / cnt).toFixed(1);
            grouped[m][s].achieved = +(grouped[m][s].achieved / cnt).toFixed(1);
        });
    });

    return grouped;
}

function destroyCharts() {
    Object.keys(activeCharts).forEach(id => {
        if (activeCharts[id]) activeCharts[id].destroy();
    });
    activeCharts = {};
}
