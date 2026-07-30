// --- COLUMN / STACKED BAR CHART BUILDER ---
// Replaces line chart rendering logic with bar chart comparison for Target, Cap, and Achieved.

function renderMetricCharts(data) {
    const container = document.getElementById('charts-container');
    if (!container) return;
    
    container.innerHTML = ''; // Clear existing charts

    // Group data by METRIC & SUBMETRIC
    const metricsGrouped = groupDataByMetric(data);

    Object.keys(metricsGrouped).forEach(metricName => {
        const metricData = metricsGrouped[metricName];
        
        // Create Chart Card Wrapper
        const chartCard = document.createElement('div');
        chartCard.className = 'chart-card';
        
        const title = document.createElement('h3');
        title.innerText = metricName;
        chartCard.appendChild(title);

        const canvas = document.createElement('canvas');
        canvas.id = `chart-${metricName.replace(/\s+/g, '-').toLowerCase()}`;
        chartCard.appendChild(canvas);
        
        container.appendChild(chartCard);

        // Extract labels (Sub-metrics or Categories) and series data
        const labels = Object.keys(metricData); // Sub-metrics
        const targetData = labels.map(sub => metricData[sub].target);
        const capData = labels.map(sub => metricData[sub].cap);
        const achievedData = labels.map(sub => metricData[sub].achieved);

        // Chart.js Configuration
        new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Target',
                        data: targetData,
                        backgroundColor: 'rgba(54, 162, 235, 0.7)', // Blue
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        stack: 'TargetStack'
                    },
                    {
                        label: 'Cap / Limit',
                        data: capData,
                        backgroundColor: 'rgba(255, 159, 64, 0.7)', // Orange
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 1,
                        stack: 'CapStack'
                    },
                    {
                        label: 'Achieved',
                        data: achievedData,
                        backgroundColor: 'rgba(75, 192, 192, 0.7)', // Teal / Green
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                        stack: 'AchievedStack'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#ffffff' }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
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
                        ticks: { color: '#cccccc' },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#cccccc',
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    });
}

// Helper to structure raw rows into metric/submetric metrics
function groupDataByMetric(rows) {
    const grouped = {};

    rows.forEach(row => {
        const metric = row[COL.METRIC] || 'Overall';
        const submetric = row[COL.SUBMETRIC] || 'General';

        if (!grouped[metric]) {
            grouped[metric] = {};
        }

        if (!grouped[metric][submetric]) {
            grouped[metric][submetric] = { target: 0, cap: 0, achieved: 0, count: 0 };
        }

        grouped[metric][submetric].target += parseFloat(row[COL.TARGET]) || 0;
        grouped[metric][submetric].cap += parseFloat(row[COL.CAP]) || 0;
        grouped[metric][submetric].achieved += parseFloat(row[COL.ACHIEVED]) || 0;
        grouped[metric][submetric].count += 1;
    });

    // Average or normalize values per sub-metric
    Object.keys(grouped).forEach(metric => {
        Object.keys(grouped[metric]).forEach(sub => {
            const count = grouped[metric][sub].count || 1;
            grouped[metric][sub].target = parseFloat((grouped[metric][sub].target / count).toFixed(2));
            grouped[metric][sub].cap = parseFloat((grouped[metric][sub].cap / count).toFixed(2));
            grouped[metric][sub].achieved = parseFloat((grouped[metric][sub].achieved / count).toFixed(2));
        });
    });

    return grouped;
}
