/**
 * VP Operations Command Center
 * Metric & Sub-Metric Stacked Bar Visualizations
 */

// Column indices based on your dataset layout
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

// Global object to keep track of active Chart.js instances so they clean up properly on filter re-render
let activeCharts = {};

function renderMetricCharts(filteredData) {
    const container = document.getElementById('charts-container'); // or your grid wrapper ID
    if (!container) return;

    // Destroy existing Chart instances to prevent canvas reuse errors
    Object.keys(activeCharts).forEach(key => {
        if (activeCharts[key]) activeCharts[key].destroy();
    });
    activeCharts = {};

    container.innerHTML = ''; // Reset UI view

    // 1. Group data by Metric -> Sub-metric -> aggregated Target, Cap, Achieved
    const groupedMetrics = processDataForStackedCharts(filteredData);

    // 2. Render a Stacked Column Chart card for each primary Metric
    Object.keys(groupedMetrics).forEach(metricName => {
        const metricData = groupedMetrics[metricName];

        // UI Card Wrapper
        const card = document.createElement('div');
        card.className = 'chart-card bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 mb-6';

        // Card Title
        const titleContainer = document.createElement('div');
        titleContainer.className = 'flex justify-between items-center mb-4';
        titleContainer.innerHTML = `
            <h3 class="text-base font-semibold text-white flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                ${metricName}
            </h3>
            <span class="text-xs text-slate-400">Target vs Cap vs Achieved</span>
        `;
        card.appendChild(titleContainer);

        // Canvas for Chart
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'relative h-64 w-full';
        
        const canvas = document.createElement('canvas');
        const canvasId = `chart-${metricName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
        canvas.id = canvasId;
        
        canvasContainer.appendChild(canvas);
        card.appendChild(canvasContainer);
        container.appendChild(card);

        // 3. Prepare Chart Data (Labels = Overall Metric + Sub-metrics)
        const submetricLabels = Object.keys(metricData);
        
        const achievedValues = submetricLabels.map(sub => metricData[sub].achieved);
        const capValues = submetricLabels.map(sub => metricData[sub].cap);
        const targetValues = submetricLabels.map(sub => metricData[sub].target);

        // 4. Build Stacked Column Chart using Chart.js
        const ctx = canvas.getContext('2d');
        activeCharts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: submetricLabels,
                datasets: [
                    {
                        label: 'Achieved',
                        data: achievedValues,
                        backgroundColor: '#3b82f6', // Bright Blue
                        borderColor: '#2563eb',
                        borderWidth: 1,
                        stack: 'ComparisonStack',
                        barPercentage: 0.5
                    },
                    {
                        label: 'Min/Max Cap',
                        data: capValues,
                        backgroundColor: '#f59e0b', // Amber / Orange
                        borderColor: '#d97706',
                        borderWidth: 1,
                        stack: 'ComparisonStack',
                        barPercentage: 0.5
                    },
                    {
                        label: 'Target',
                        data: targetValues,
                        backgroundColor: '#10b981', // Emerald / Green
                        borderColor: '#059669',
                        borderWidth: 1,
                        stack: 'ComparisonStack',
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
                        labels: {
                            color: '#94a3b8',
                            font: { size: 11 },
                            usePointStyle: true,
                            boxWidth: 8
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
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
                        stacked: true, // Enables column stacking
                        ticks: { color: '#94a3b8', font: { size: 11 } },
                        grid: { display: false }
                    },
                    y: {
                        stacked: true, // Enables column stacking
                        beginAtZero: true,
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 11 },
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    }
                }
            }
        });
    });
}

/**
 * Aggregates raw rows by Metric -> Sub-metric
 */
function processDataForStackedCharts(rows) {
    const grouped = {};

    rows.forEach(row => {
        const metric = row[COL.METRIC] ? row[COL.METRIC].trim() : 'Unassigned';
        let submetric = row[COL.SUBMETRIC] ? row[COL.SUBMETRIC].trim() : 'Overall';

        if (!submetric || submetric.toLowerCase() === 'none') {
            submetric = 'Overall';
        }

        if (!grouped[metric]) {
            grouped[metric] = {};
        }

        if (!grouped[metric][submetric]) {
            grouped[metric][submetric] = {
                targetSum: 0,
                capSum: 0,
                achievedSum: 0,
                count: 0
            };
        }

        // Parse numerical values safely
        const targetVal = parseFloat(row[COL.TARGET]) || 0;
        const capVal = parseFloat(row[COL.CAP]) || 0;
        const achievedVal = parseFloat(row[COL.ACHIEVED]) || 0;

        grouped[metric][submetric].targetSum += targetVal;
        grouped[metric][submetric].capSum += capVal;
        grouped[metric][submetric].achievedSum += achievedVal;
        grouped[metric][submetric].count += 1;
    });

    // Compute averages for chart display
    const result = {};
    Object.keys(grouped).forEach(metric => {
        result[metric] = {};
        Object.keys(grouped[metric]).forEach(sub => {
            const item = grouped[metric][sub];
            const cnt = item.count || 1;

            result[metric][sub] = {
                target: parseFloat((item.targetSum / cnt).toFixed(1)),
                cap: parseFloat((item.capSum / cnt).toFixed(1)),
                achieved: parseFloat((item.achievedSum / cnt).toFixed(1))
            };
        });
    });

    return result;
}
