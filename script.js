// Dataset structure supporting both Metric Summary and Sub-Metric Breakdown
const metricsData = [
  {
    id: 'admissions',
    title: 'Admissions AY26',
    subtitle: 'Volume breakdown vs Target, Cap & Trend',
    unitType: 'number',
    // Metric Summary Level Data
    metricView: {
      categories: ['Admissions AY26 Total'],
      target: [35000],
      minMaxCap: [43000],
      achieved: [35000],
      trend: [100.0]
    },
    // Sub-Metric Level Data
    subMetricView: {
      categories: ['UG Admissions', 'PG Admissions', 'Diploma', 'Certifications'],
      target: [12000, 10000, 8000, 5000],
      minMaxCap: [15000, 12000, 10000, 6000],
      achieved: [13500, 9200, 7800, 4500],
      trend: [112.5, 92.0, 97.5, 90.0]
    }
  },
  {
    id: 'attendance',
    title: 'Attendance',
    subtitle: 'Percentage breakdown across cohorts',
    unitType: 'percentage',
    metricView: {
      categories: ['Overall Attendance'],
      target: [85],
      minMaxCap: [95],
      achieved: [88.5],
      trend: [104.1]
    },
    subMetricView: {
      categories: ['Primary School', 'High School', 'Faculty/Staff', 'Special Events'],
      target: [85, 85, 90, 80],
      minMaxCap: [95, 95, 98, 90],
      achieved: [89, 82, 95, 88],
      trend: [104.7, 96.4, 105.5, 110.0]
    }
  },
  {
    id: 'testPerformance',
    title: 'Test Performance and Attendance',
    subtitle: 'Average scores across subject domains',
    unitType: 'percentage',
    metricView: {
      categories: ['Overall Performance'],
      target: [75],
      minMaxCap: [90],
      achieved: [78.2],
      trend: [104.2]
    },
    subMetricView: {
      categories: ['Mathematics', 'Science', 'Languages', 'Social Studies'],
      target: [75, 70, 80, 75],
      minMaxCap: [90, 85, 95, 90],
      achieved: [81, 74, 86, 72],
      trend: [108.0, 105.7, 107.5, 96.0]
    }
  },
  {
    id: 'emiCollection',
    title: 'EMI Collection',
    subtitle: 'Quarterly financial collection metrics in ₹',
    unitType: 'currency',
    metricView: {
      categories: ['Total EMI YTD'],
      target: [65000],
      minMaxCap: [75000],
      achieved: [64000],
      trend: [98.4]
    },
    subMetricView: {
      categories: ['Q1 Collection', 'Q2 Collection', 'Q3 Collection', 'Q4 Collection'],
      target: [15000, 15000, 17000, 18000],
      minMaxCap: [18000, 18000, 19500, 19500],
      achieved: [14800, 16200, 16500, 16500],
      trend: [98.6, 108.0, 97.0, 91.6]
    }
  }
];

// Helper to format axis labels based on unit type
function formatValue(value, type) {
  if (type === 'percentage') return value + '%';
  if (type === 'currency') return '₹' + (value >= 1000 ? (value / 1000) + 'k' : value);
  if (type === 'number' && value >= 1000) return (value / 1000) + 'k';
  return value;
}

// Global chart store for easy chart destruction and updating
const chartInstances = {};

// Function to render layout cards
function initDashboard() {
  const grid = document.getElementById('metricsGrid');

  metricsData.forEach(metric => {
    const cardHTML = `
      <div class="metric-card">
        <div class="card-header">
          <div class="card-title-group">
            <h3>${metric.title}</h3>
            <p>${metric.subtitle}</p>
          </div>
          <div class="view-toggle">
            <button class="toggle-btn active" id="btn-sub-${metric.id}" onclick="switchView('${metric.id}', 'subMetricView')">Sub-Metric</button>
            <button class="toggle-btn" id="btn-metric-${metric.id}" onclick="switchView('${metric.id}', 'metricView')">Metric Level</button>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="chart-${metric.id}"></canvas>
        </div>
      </div>
    `;
    grid.insertAdjacentHTML('beforeend', cardHTML);
    createChart(metric, 'subMetricView');
  });
}

// Function to build Chart instance
function createChart(metric, viewType) {
  const dataView = metric[viewType];
  const ctx = document.getElementById(`chart-${metric.id}`).getContext('2d');

  chartInstances[metric.id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dataView.categories,
      datasets: [
        {
          type: 'line',
          label: '% Trend Line',
          data: dataView.trend,
          borderColor: '#10b981', // Green trend line
          backgroundColor: '#10b981',
          borderWidth: 2.5,
          pointRadius: 4,
          yAxisID: 'yTrend',
          tension: 0.3
        },
        {
          type: 'bar',
          label: 'Target',
          data: dataView.target,
          backgroundColor: '#6366f1', // Blue
          borderRadius: 4,
          yAxisID: 'yMain'
        },
        {
          type: 'bar',
          label: 'Min / Max Cap',
          data: dataView.minMaxCap,
          backgroundColor: '#f59e0b', // Yellow
          borderRadius: 4,
          yAxisID: 'yMain'
        },
        {
          type: 'bar',
          label: 'Achieved',
          data: dataView.achieved,
          backgroundColor: '#f43f5e', // Pinkish Red
          borderRadius: 4,
          yAxisID: 'yMain'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 10, usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.dataset.yAxisID === 'yTrend') {
                return label + context.raw + '% Trend';
              }
              return label + formatValue(context.raw, metric.unitType);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        yMain: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: (val) => formatValue(val, metric.unitType)
          }
        },
        yTrend: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            callback: (val) => val + '%'
          }
        }
      }
    }
  });
}

// Toggle function between Metric view and Sub-Metric view
function switchView(metricId, viewType) {
  const metric = metricsData.find(m => m.id === metricId);
  if (!metric) return;

  // Destroy previous chart instance
  if (chartInstances[metricId]) {
    chartInstances[metricId].destroy();
  }

  // Update button active styles
  const btnSub = document.getElementById(`btn-sub-${metricId}`);
  const btnMetric = document.getElementById(`btn-metric-${metricId}`);

  if (viewType === 'subMetricView') {
    btnSub.classList.add('active');
    btnMetric.classList.remove('active');
  } else {
    btnMetric.classList.add('active');
    btnSub.classList.remove('active');
  }

  // Re-render chart with new dataset
  createChart(metric, viewType);
}

// Initialize Dashboard when DOM loads
document.addEventListener('DOMContentLoaded', initDashboard);
