/**
 * India Rainfall Analytics & Predictive Dashboard - Application Controller
 * Academic & Climate Research Suite
 * Integrates 115-year historical subdivision series (1901-2015) and 641 district normals.
 */

(function () {
  'use strict';

  // --- Global State ---
  const state = {
    data: null,
    activeSubdivision: 'ALL',
    startYear: 1901,
    endYear: 2015,
    activeSeason: 'ANNUAL',
    activeUnit: 'mm', // 'mm' or 'cm'
    activeTab: 'tab-trends',
    // District Explorer State
    activeState: 'ALL',
    districtSearch: '',
    districtSortCol: 'all_india_rank',
    districtSortDir: 'asc',
    districtPage: 1,
    districtPageSize: 15,
    // Predictive Studio State
    forecastRegion: 'ALL',
    forecastYear: 2025,
    forecastModel: 'OLS'
  };

  // --- Chart Instances Registry ---
  const charts = {};

  // --- Unit Conversion Helper ---
  function formatVal(val, decimals = 1) {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    const multiplier = state.activeUnit === 'cm' ? 0.1 : 1.0;
    const converted = val * multiplier;
    return converted.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function getUnitLabel() {
    return state.activeUnit;
  }

  // --- IMD Status Classifier ---
  function getImdStatus(departure, isSubdivision = false) {
    if (isSubdivision) {
      // IMD Official Meteorological Subdivision Criteria
      if (departure >= 20.0) return { label: 'Excess', badgeClass: 'badge-excess', color: '#10b981' };
      if (departure >= -19.0) return { label: 'Normal', badgeClass: 'badge-normal', color: '#38bdf8' };
      if (departure >= -59.0) return { label: 'Deficient', badgeClass: 'badge-deficient', color: '#f59e0b' };
      return { label: 'Scanty / Drought', badgeClass: 'badge-scanty', color: '#ef4444' };
    } else {
      // IMD Official All-India National Criteria
      if (departure > 10.0) return { label: 'Excess', badgeClass: 'badge-excess', color: '#10b981' };
      if (departure >= -10.0) return { label: 'Normal', badgeClass: 'badge-normal', color: '#38bdf8' };
      if (departure >= -29.0) return { label: 'Deficient', badgeClass: 'badge-deficient', color: '#f59e0b' };
      return { label: 'Scanty / Drought', badgeClass: 'badge-scanty', color: '#ef4444' };
    }
  }

  // --- Initialize Application ---
  function init() {
    if (!window.RAINFALL_DATA) {
      console.error('Rainfall data not loaded.');
      return;
    }
    state.data = window.RAINFALL_DATA;

    // Check URL parameters for deep-linking
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('tab')) {
      state.activeTab = urlParams.get('tab');
    }
    if (urlParams.has('subdivision')) {
      state.activeSubdivision = urlParams.get('subdivision');
    }
    if (urlParams.has('season')) {
      state.activeSeason = urlParams.get('season');
    }
    if (urlParams.has('unit')) {
      state.activeUnit = urlParams.get('unit');
    }

    populateFilterDropdowns();
    setupEventListeners();
    applyInitialStateToUI();
    renderAllViews();
  }

  function applyInitialStateToUI() {
    if (state.activeTab) {
      document.querySelectorAll('.tab-btn').forEach(b => {
        const isTarget = b.dataset.tab === state.activeTab;
        b.classList.toggle('active', isTarget);
        b.setAttribute('aria-selected', isTarget ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.toggle('active', c.id === state.activeTab);
      });
    }
    if (state.activeSubdivision) {
      const subSelect = document.getElementById('subdivisionSelect');
      if (subSelect) subSelect.value = state.activeSubdivision;
    }
    if (state.activeSeason) {
      const seasonSelect = document.getElementById('seasonSelect');
      if (seasonSelect) seasonSelect.value = state.activeSeason;
    }
    if (state.activeUnit) {
      const unitDisplay = document.getElementById('unitDisplay');
      if (unitDisplay) unitDisplay.textContent = `Unit: ${state.activeUnit}`;
    }
  }

  // --- Populate Select Controls ---
  function populateFilterDropdowns() {
    const hist = state.data.historical;
    const distData = state.data.districts_data;

    // 1. Subdivision Select
    const subSelect = document.getElementById('subdivisionSelect');
    const predSubSelect = document.getElementById('predictSubdivisionSelect');
    
    hist.subdivisions.forEach(sub => {
      const opt1 = document.createElement('option');
      opt1.value = sub;
      opt1.textContent = sub;
      subSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = sub;
      opt2.textContent = sub;
      predSubSelect.appendChild(opt2);
    });

    // 2. Year Range Selects
    const startSelect = document.getElementById('startYearSelect');
    const endSelect = document.getElementById('endYearSelect');
    
    hist.all_years.forEach(y => {
      const optStart = new Option(y, y, false, y === 1901);
      const optEnd = new Option(y, y, false, y === 2015);
      startSelect.add(optStart);
      endSelect.add(optEnd);
    });

    // 3. State Filter Select for District Tab
    const stateSelect = document.getElementById('stateFilterSelect');
    distData.states.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = `${st} (${distData.state_summaries[st].district_count} districts)`;
      stateSelect.appendChild(opt);
    });
  }

  // --- Setup Event Listeners ---
  function setupEventListeners() {
    // 1. Subdivision Filter Change
    document.getElementById('subdivisionSelect').addEventListener('change', (e) => {
      state.activeSubdivision = e.target.value;
      renderAllViews();
    });

    // 2. Year Range Changes
    document.getElementById('startYearSelect').addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > state.endYear) {
        state.startYear = state.endYear;
        e.target.value = state.endYear;
      } else {
        state.startYear = val;
      }
      updateYearUI();
      renderAllViews();
    });

    document.getElementById('endYearSelect').addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val < state.startYear) {
        state.endYear = state.startYear;
        e.target.value = state.startYear;
      } else {
        state.endYear = val;
      }
      updateYearUI();
      renderAllViews();
    });

    // 3. Year Presets
    document.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.startYear = parseInt(btn.dataset.start, 10);
        state.endYear = parseInt(btn.dataset.end, 10);
        document.getElementById('startYearSelect').value = state.startYear;
        document.getElementById('endYearSelect').value = state.endYear;
        updateYearUI();
        renderAllViews();
      });
    });

    // 4. Season Filter Change
    document.getElementById('seasonSelect').addEventListener('change', (e) => {
      state.activeSeason = e.target.value;
      renderAllViews();
    });

    // 5. Unit Toggle (mm / cm)
    document.getElementById('btnUnitToggle').addEventListener('click', () => {
      state.activeUnit = state.activeUnit === 'mm' ? 'cm' : 'mm';
      document.getElementById('unitDisplay').textContent = `Unit: ${state.activeUnit}`;
      renderAllViews();
    });

    // 6. Reset Filters
    document.getElementById('btnResetFilters').addEventListener('click', () => {
      state.activeSubdivision = 'ALL';
      state.startYear = 1901;
      state.endYear = 2015;
      state.activeSeason = 'ANNUAL';
      state.activeUnit = 'mm';
      document.getElementById('subdivisionSelect').value = 'ALL';
      document.getElementById('startYearSelect').value = 1901;
      document.getElementById('endYearSelect').value = 2015;
      document.getElementById('seasonSelect').value = 'ANNUAL';
      document.getElementById('unitDisplay').textContent = 'Unit: mm';
      document.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
      document.querySelector('.preset-chip[data-start="1901"][data-end="2015"]').classList.add('active');
      updateYearUI();
      renderAllViews();
    });

    // 7. Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const targetTabId = btn.dataset.tab;
        state.activeTab = targetTabId;
        const targetPane = document.getElementById(targetTabId);
        if (targetPane) targetPane.classList.add('active');

        // Trigger chart resize / update on tab switch
        handleTabResize(targetTabId);
      });
    });

    // 8. District State Filter
    document.getElementById('stateFilterSelect').addEventListener('change', (e) => {
      state.activeState = e.target.value;
      state.districtPage = 1;
      renderDistrictView();
    });

    // 9. District Search Input
    document.getElementById('districtSearchInput').addEventListener('input', (e) => {
      state.districtSearch = e.target.value.toLowerCase().trim();
      state.districtPage = 1;
      renderDistrictTable();
    });

    // 10. District Pagination
    document.getElementById('btnPrevPage').addEventListener('click', () => {
      if (state.districtPage > 1) {
        state.districtPage--;
        renderDistrictTable();
      }
    });

    document.getElementById('btnNextPage').addEventListener('click', () => {
      const maxPage = Math.ceil(getFilteredDistricts().length / state.districtPageSize);
      if (state.districtPage < maxPage) {
        state.districtPage++;
        renderDistrictTable();
      }
    });

    // 11. District Sort Columns
    document.querySelectorAll('#tableDistricts th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (state.districtSortCol === col) {
          state.districtSortDir = state.districtSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.districtSortCol = col;
          state.districtSortDir = (col === 'all_india_rank' || col === 'district' || col === 'state') ? 'asc' : 'desc';
        }
        renderDistrictTable();
      });
    });

    // 12. Predictive Controls
    document.getElementById('predictSubdivisionSelect').addEventListener('change', (e) => {
      state.forecastRegion = e.target.value;
      updatePredictiveModel();
    });
    document.getElementById('forecastHorizonSelect').addEventListener('change', (e) => {
      state.forecastYear = parseInt(e.target.value, 10);
      updatePredictiveModel();
    });
    document.getElementById('predictModelSelect').addEventListener('change', (e) => {
      state.forecastModel = e.target.value;
      updatePredictiveModel();
    });

    // 13. Export Buttons
    document.getElementById('btnExportCSV').addEventListener('click', exportCSV);
    document.getElementById('btnExportJSON').addEventListener('click', exportJSON);
  }

  function updateYearUI() {
    document.getElementById('yearRangeText').textContent = `${state.startYear} – ${state.endYear}`;
  }

  function handleTabResize(tabId) {
    setTimeout(() => {
      Object.values(charts).forEach(c => {
        if (c) c.resize();
      });
    }, 50);
  }

  // --- Data Getter for Current Selection ---
  function getActiveTimeSeries() {
    const hist = state.data.historical;
    let series = [];
    if (state.activeSubdivision === 'ALL') {
      series = hist.national_timeseries;
    } else {
      const profile = hist.subdivision_profiles[state.activeSubdivision];
      series = profile ? profile.timeseries : [];
    }
    return series.filter(item => item.year >= state.startYear && item.year <= state.endYear);
  }

  function getActiveLPA() {
    const hist = state.data.historical;
    if (state.activeSubdivision === 'ALL') {
      return hist.national_lpa;
    }
    const prof = hist.subdivision_profiles[state.activeSubdivision];
    return prof ? prof.lpa : hist.national_lpa;
  }

  // --- Render All Dashboard Views ---
  function renderAllViews() {
    renderKPIs();
    renderHistoricalTrendsCharts();
    renderMonthlySeasonalCharts();
    renderSubdivisionsView();
    renderDistrictView();
    updatePredictiveModel();
  }

  // =========================================================================
  // 1. KPI Ribbon Cards
  // =========================================================================
  function renderKPIs() {
    const series = getActiveTimeSeries();
    if (!series || series.length === 0) return;

    const unit = getUnitLabel();
    const lpa = getActiveLPA();

    // 1. Mean Annual / Selected Season
    let meanVal = 0;
    if (state.activeSeason === 'ANNUAL') {
      meanVal = series.reduce((acc, s) => acc + s.annual, 0) / series.length;
    } else {
      meanVal = series.reduce((acc, s) => acc + (s.seasons[state.activeSeason] || 0), 0) / series.length;
    }

    document.getElementById('kpiMeanVal').textContent = formatVal(meanVal, 1);
    document.getElementById('kpiMeanUnit').textContent = unit;
    
    // LPA comparison & IMD status
    const departure = ((meanVal - lpa) / lpa) * 100;
    const isSub = state.activeSubdivision !== 'ALL';
    const status = getImdStatus(departure, isSub);
    document.getElementById('kpiLpaComparison').textContent = `LPA: ${formatVal(lpa, 1)} ${unit} (${departure >= 0 ? '+' : ''}${departure.toFixed(1)}%)`;
    
    const statusBadge = document.getElementById('kpiStatusBadge');
    statusBadge.textContent = status.label;
    statusBadge.className = `kpi-badge ${status.badgeClass}`;

    // 2. SW Monsoon Share
    const monsoonVals = series.map(s => s.seasons['Jun-Sep'] || 0);
    const meanMonsoon = monsoonVals.reduce((a, b) => a + b, 0) / series.length;
    const annualMean = series.reduce((acc, s) => acc + s.annual, 0) / series.length;
    const monsoonShare = annualMean > 0 ? (meanMonsoon / annualMean) * 100 : 0;

    document.getElementById('kpiMonsoonVal').textContent = formatVal(meanMonsoon, 1);
    document.getElementById('kpiMonsoonUnit').textContent = unit;
    document.getElementById('kpiMonsoonShare').textContent = `${monsoonShare.toFixed(1)}% of Annual`;

    // 3. Peak Wettest Year
    const peakItem = series.reduce((max, cur) => cur.annual > max.annual ? cur : max, series[0]);
    const peakDeparture = ((peakItem.annual - lpa) / lpa) * 100;
    document.getElementById('kpiPeakVal').textContent = formatVal(peakItem.annual, 1);
    document.getElementById('kpiPeakUnit').textContent = unit;
    document.getElementById('kpiPeakYearLabel').textContent = `Peak Year: ${peakItem.year}`;
    document.getElementById('kpiPeakDeparture').textContent = `${peakDeparture >= 0 ? '+' : ''}${peakDeparture.toFixed(1)}% vs LPA`;

    // 4. Driest / Drought Year
    const driestItem = series.reduce((min, cur) => cur.annual < min.annual ? cur : min, series[0]);
    const driestDeparture = ((driestItem.annual - lpa) / lpa) * 100;
    document.getElementById('kpiDriestVal').textContent = formatVal(driestItem.annual, 1);
    document.getElementById('kpiDriestUnit').textContent = unit;
    document.getElementById('kpiDriestYearLabel').textContent = `Drought Year: ${driestItem.year}`;
    document.getElementById('kpiDriestDeparture').textContent = `${driestDeparture.toFixed(1)}% vs LPA`;

    // 5. Climate Trend Slope
    const xVals = series.map(s => s.year);
    const yVals = series.map(s => s.annual);
    const n = xVals.length;
    let slope = 0;
    if (n > 1) {
      const xMean = xVals.reduce((a, b) => a + b, 0) / n;
      const yMean = yVals.reduce((a, b) => a + b, 0) / n;
      const num = xVals.reduce((acc, x, i) => acc + (x - xMean) * (yVals[i] - yMean), 0);
      const den = xVals.reduce((acc, x) => acc + Math.pow(x - xMean, 2), 0);
      slope = den !== 0 ? num / den : 0;
    }
    const decadalSlope = slope * 10;
    const multiplier = state.activeUnit === 'cm' ? 0.1 : 1.0;
    const slopeDisplay = (slope * multiplier).toFixed(2);
    const decadeDisplay = (decadalSlope * multiplier).toFixed(1);

    document.getElementById('kpiTrendSlope').textContent = slopeDisplay;
    document.getElementById('kpiTrendDecade').textContent = `${decadeDisplay >= 0 ? '+' : ''}${decadeDisplay} ${unit} / decade`;
    
    const trajBadge = document.getElementById('kpiTrendTrajectory');
    if (slope > 0.1) {
      trajBadge.textContent = 'Increasing Trend';
      trajBadge.className = 'kpi-badge badge-excess';
    } else if (slope < -0.1) {
      trajBadge.textContent = 'Subtle Drying';
      trajBadge.className = 'kpi-badge badge-deficient';
    } else {
      trajBadge.textContent = 'Stable Baseline';
      trajBadge.className = 'kpi-badge badge-normal';
    }

    // 6. Observation Count
    document.getElementById('kpiTotalRecords').textContent = (series.length * (state.activeSubdivision === 'ALL' ? 36 : 1)).toLocaleString();
  }

  // =========================================================================
  // 2. Tab 1: Historical Trends Charts
  // =========================================================================
  function renderHistoricalTrendsCharts() {
    const series = getActiveTimeSeries();
    const lpa = getActiveLPA();
    const multiplier = state.activeUnit === 'cm' ? 0.1 : 1.0;
    const unit = getUnitLabel();

    // Chart 1: 115-Year Annual Line Chart
    const ctxTrend = document.getElementById('chartHistoricalTrend');
    if (ctxTrend) {
      if (charts.historicalTrend) charts.historicalTrend.destroy();

      const years = series.map(s => s.year);
      let metricVals = [];
      if (state.activeSeason === 'ANNUAL') {
        metricVals = series.map(s => s.annual * multiplier);
      } else {
        metricVals = series.map(s => (s.seasons[state.activeSeason] || 0) * multiplier);
      }
      const rollingVals = series.map(s => (s.rolling_5yr || s.annual) * multiplier);
      const lpaLine = series.map(() => lpa * multiplier);

      charts.historicalTrend = new Chart(ctxTrend, {
        type: 'line',
        data: {
          labels: years,
          datasets: [
            {
              label: `${state.activeSeason === 'ANNUAL' ? 'Annual Rainfall' : state.activeSeason} (${unit})`,
              data: metricVals,
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              fill: true,
              borderWidth: 2,
              tension: 0.1,
              pointRadius: series.length > 50 ? 2 : 4,
              pointHoverRadius: 6,
              pointBackgroundColor: '#38bdf8'
            },
            {
              label: '5-Year Rolling Mean',
              data: rollingVals,
              borderColor: '#f59e0b',
              borderWidth: 2.5,
              fill: false,
              pointRadius: 0,
              tension: 0.25
            },
            {
              label: `LPA Baseline (${formatVal(lpa, 1)} ${unit})`,
              data: lpaLine,
              borderColor: 'rgba(255, 255, 255, 0.45)',
              borderWidth: 1.5,
              borderDash: [6, 6],
              fill: false,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(14, 21, 38, 0.95)',
              titleColor: '#fff',
              bodyColor: '#cbd5e1',
              borderColor: 'rgba(56, 189, 248, 0.3)',
              borderWidth: 1,
              padding: 12,
              displayColors: true,
              callbacks: {
                label: function (context) {
                  return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} ${unit}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', maxTicksLimit: 16 }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.06)' },
              ticks: { color: '#94a3b8' },
              title: { display: true, text: `Precipitation (${unit})`, color: '#64748b' }
            }
          }
        }
      });
    }

    // Chart 2: Departure Anomaly Bar Chart
    const ctxAnomaly = document.getElementById('chartDepartureAnomaly');
    if (ctxAnomaly) {
      if (charts.departureAnomaly) charts.departureAnomaly.destroy();

      const years = series.map(s => s.year);
      const departures = series.map(s => {
        return Number((((s.annual - lpa) / lpa) * 100).toFixed(1));
      });
      const isSub = state.activeSubdivision !== 'ALL';
      const barColors = departures.map(d => {
        return getImdStatus(d, isSub).color;
      });

      charts.departureAnomaly = new Chart(ctxAnomaly, {
        type: 'bar',
        data: {
          labels: years,
          datasets: [{
            label: 'Departure from LPA (%)',
            data: departures,
            backgroundColor: barColors,
            borderRadius: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(14, 21, 38, 0.95)',
              callbacks: {
                label: function (ctx) {
                  const val = ctx.parsed.y;
                  const status = getImdStatus(val, isSub);
                  return `Departure: ${val >= 0 ? '+' : ''}${val.toFixed(1)}% (${status.label})`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8', maxTicksLimit: 12 }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.06)' },
              ticks: {
                color: '#94a3b8',
                callback: v => `${v}%`
              },
              title: { display: true, text: 'IMD Departure (%)', color: '#64748b' }
            }
          }
        }
      });
    }

    // Chart 3: Decadal Shifts Bar Chart
    const ctxDecades = document.getElementById('chartDecadalShifts');
    if (ctxDecades) {
      if (charts.decadalShifts) charts.decadalShifts.destroy();

      const decadesMap = {};
      series.forEach(s => {
        const dec = `${Math.floor(s.year / 10) * 10}s`;
        if (!decadesMap[dec]) decadesMap[dec] = [];
        decadesMap[dec].push(s.annual);
      });

      const decadeLabels = Object.keys(decadesMap).sort();
      const decadeAverages = decadeLabels.map(d => {
        const vals = decadesMap[d];
        return Number(((vals.reduce((a, b) => a + b, 0) / vals.length) * multiplier).toFixed(1));
      });

      charts.decadalShifts = new Chart(ctxDecades, {
        type: 'bar',
        data: {
          labels: decadeLabels,
          datasets: [{
            label: `Decadal Mean (${unit})`,
            data: decadeAverages,
            backgroundColor: 'rgba(99, 102, 241, 0.7)',
            borderColor: '#818cf8',
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(14, 21, 38, 0.95)',
              callbacks: {
                label: ctx => `Decadal Average: ${ctx.parsed.y} ${unit}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8' }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.06)' },
              ticks: { color: '#94a3b8' },
              title: { display: true, text: `Mean Precipitation (${unit})`, color: '#64748b' }
            }
          }
        }
      });
    }
  }

  // =========================================================================
  // 3. Tab 2: Monthly & Seasonal Charts
  // =========================================================================
  function renderMonthlySeasonalCharts() {
    const series = getActiveTimeSeries();
    if (!series || series.length === 0) return;

    const multiplier = state.activeUnit === 'cm' ? 0.1 : 1.0;
    const unit = getUnitLabel();
    const months = state.data.metadata.months;

    // Compute Monthly Mean, Min, Max for current filter selection
    const monthStats = months.map(m => {
      const vals = series.map(s => (s.months[m] || 0) * multiplier);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      return { month: m, mean: round(mean, 1), min: round(min, 1), max: round(max, 1) };
    });

    // Chart 4: 12-Month Climatological Curve
    const ctxMonthly = document.getElementById('chartMonthlyCurve');
    if (ctxMonthly) {
      if (charts.monthlyCurve) charts.monthlyCurve.destroy();

      charts.monthlyCurve = new Chart(ctxMonthly, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            {
              label: `Mean Rainfall (${unit})`,
              data: monthStats.map(s => s.mean),
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.25)',
              borderWidth: 3,
              fill: true,
              tension: 0.35,
              pointRadius: 5,
              pointBackgroundColor: '#38bdf8'
            },
            {
              label: `Historical Max (${unit})`,
              data: monthStats.map(s => s.max),
              borderColor: 'rgba(52, 211, 153, 0.6)',
              borderWidth: 1.5,
              borderDash: [4, 4],
              fill: false,
              pointRadius: 3
            },
            {
              label: `Historical Min (${unit})`,
              data: monthStats.map(s => s.min),
              borderColor: 'rgba(248, 113, 113, 0.6)',
              borderWidth: 1.5,
              borderDash: [4, 4],
              fill: false,
              pointRadius: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          plugins: {
            legend: {
              labels: { color: '#94a3b8', font: { size: 11 } }
            },
            tooltip: {
              backgroundColor: 'rgba(14, 21, 38, 0.95)',
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} ${unit}`
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8' }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.06)' },
              ticks: { color: '#94a3b8' },
              title: { display: true, text: `Precipitation (${unit})`, color: '#64748b' }
            }
          }
        }
      });
    }

    // Chart 5: Seasonal Contribution Doughnut
    const ctxSeason = document.getElementById('chartSeasonalDonut');
    if (ctxSeason) {
      if (charts.seasonalDonut) charts.seasonalDonut.destroy();

      const seasonTotals = {
        'SW Monsoon (Jun–Sep)': series.reduce((a, s) => a + (s.seasons['Jun-Sep'] || 0), 0),
        'Pre-Monsoon (Mar–May)': series.reduce((a, s) => a + (s.seasons['Mar-May'] || 0), 0),
        'Post-Monsoon (Oct–Dec)': series.reduce((a, s) => a + (s.seasons['Oct-Dec'] || 0), 0),
        'Winter (Jan–Feb)': series.reduce((a, s) => a + (s.seasons['Jan-Feb'] || 0), 0)
      };

      const labels = Object.keys(seasonTotals);
      const dataVals = labels.map(l => Number(((seasonTotals[l] / series.length) * multiplier).toFixed(1)));

      charts.seasonalDonut = new Chart(ctxSeason, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: dataVals,
            backgroundColor: [
              '#0284c7', // SW Monsoon (Deep Cyan)
              '#10b981', // Pre-Monsoon (Emerald)
              '#6366f1', // Post-Monsoon (Indigo)
              '#f59e0b'  // Winter (Amber)
            ],
            borderColor: '#0e1526',
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          animation: { duration: 400 },
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#cbd5e1', font: { size: 11 }, padding: 14 }
            },
            tooltip: {
              backgroundColor: 'rgba(14, 21, 38, 0.95)',
              callbacks: {
                label: function (ctx) {
                  const val = ctx.parsed;
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = ((val / total) * 100).toFixed(1);
                  return ` ${ctx.label}: ${val} ${unit} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    // Populate Table: Monthly Decades Matrix
    renderMonthlyDecadesTable();
  }

  function renderMonthlyDecadesTable() {
    const tbody = document.querySelector('#tableMonthlyDecades tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const series = getActiveTimeSeries();
    const multiplier = state.activeUnit === 'cm' ? 0.1 : 1.0;
    const months = state.data.metadata.months;

    const decadesMap = {};
    series.forEach(s => {
      const dec = `${Math.floor(s.year / 10) * 10}s`;
      if (!decadesMap[dec]) {
        decadesMap[dec] = { count: 0, annual: 0, months: { JAN: 0, FEB: 0, MAR: 0, APR: 0, MAY: 0, JUN: 0, JUL: 0, AUG: 0, SEP: 0, OCT: 0, NOV: 0, DEC: 0 } };
      }
      decadesMap[dec].count++;
      decadesMap[dec].annual += s.annual;
      months.forEach(m => {
        decadesMap[dec].months[m] += (s.months[m] || 0);
      });
    });

    Object.keys(decadesMap).sort().forEach(d => {
      const item = decadesMap[d];
      const tr = document.createElement('tr');
      const meanAnn = ((item.annual / item.count) * multiplier).toFixed(1);
      
      let html = `<td style="font-weight: 600; color: #38bdf8;">${d}</td>`;
      months.forEach(m => {
        const val = ((item.months[m] / item.count) * multiplier).toFixed(1);
        html += `<td class="num-cell">${val}</td>`;
      });
      html += `<td class="num-cell" style="font-weight: 700; color: #fff;">${meanAnn}</td>`;
      tr.innerHTML = html;
      tbody.appendChild(tr);
    });
  }

  // =========================================================================
  // 4. Tab 3: Subdivision Comparison (36 Regions)
  // =========================================================================
  function renderSubdivisionsView() {
    const hist = state.data.historical;
    const multiplier = state.activeUnit === 'cm' ? 0.1 : 1.0;
    const unit = getUnitLabel();

    // 1. Calculate active statistics for each subdivision
    const subStats = hist.subdivisions.map(sub => {
      const prof = hist.subdivision_profiles[sub];
      const filtered = prof.timeseries.filter(item => item.year >= state.startYear && item.year <= state.endYear);
      let val = 0;
      let monsoonVal = 0;
      if (filtered.length > 0) {
        val = filtered.reduce((a, b) => a + b.annual, 0) / filtered.length;
        monsoonVal = filtered.reduce((a, b) => a + (b.seasons['Jun-Sep'] || 0), 0) / filtered.length;
      } else {
        val = prof.lpa;
        monsoonVal = prof.seasonal_avg['Jun-Sep'];
      }
      return {
        subdivision: sub,
        mean: val,
        monsoon: monsoonVal,
        other: Math.max(0, val - monsoonVal),
        monsoon_share: val > 0 ? (monsoonVal / val) * 100 : 0
      };
    });

    // Sort descending
    subStats.sort((a, b) => b.mean - a.mean);

    // 2. Populate Top 5 Wettest and Driest Leaderboards
    const wettestList = document.getElementById('wettestSubdivisionsList');
    const driestList = document.getElementById('driestSubdivisionsList');
    if (wettestList) wettestList.innerHTML = '';
    if (driestList) driestList.innerHTML = '';

    // Top 5 Wettest
    subStats.slice(0, 5).forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'ranking-item';
      el.innerHTML = `
        <div class="ranking-left">
          <div class="ranking-rank">${idx + 1}</div>
          <div>
            <div class="ranking-name">${item.subdivision}</div>
            <div class="ranking-subtext">Monsoon: ${formatVal(item.monsoon, 1)} ${unit} (${item.monsoon_share.toFixed(1)}%)</div>
          </div>
        </div>
        <div class="ranking-val">${formatVal(item.mean, 1)} <span style="font-size: 0.72rem; color: var(--text-muted);">${unit}</span></div>
      `;
      wettestList.appendChild(el);
    });

    // Top 5 Driest
    subStats.slice(-5).reverse().forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'ranking-item';
      el.innerHTML = `
        <div class="ranking-left">
          <div class="ranking-rank" style="background: rgba(245, 158, 11, 0.15); color: var(--amber-400);">${idx + 1}</div>
          <div>
            <div class="ranking-name">${item.subdivision}</div>
            <div class="ranking-subtext">Monsoon: ${formatVal(item.monsoon, 1)} ${unit} (${item.monsoon_share.toFixed(1)}%)</div>
          </div>
        </div>
        <div class="ranking-val">${formatVal(item.mean, 1)} <span style="font-size: 0.72rem; color: var(--text-muted);">${unit}</span></div>
      `;
      driestList.appendChild(el);
    });

    // 3. Chart 6: Horizontal Bar Chart of All 36 Subdivisions
    const ctxAllSubs = document.getElementById('chartAllSubdivisions');
    if (ctxAllSubs) {
      if (charts.allSubdivisions) charts.allSubdivisions.destroy();

      const labels = subStats.map(s => s.subdivision);
      const monsoonData = subStats.map(s => Number((s.monsoon * multiplier).toFixed(1)));
      const otherData = subStats.map(s => Number((s.other * multiplier).toFixed(1)));

      charts.allSubdivisions = new Chart(ctxAllSubs, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: `SW Monsoon (Jun–Sep)`,
              data: monsoonData,
              backgroundColor: '#38bdf8',
              borderRadius: 4
            },
            {
              label: `Other Seasons`,
              data: otherData,
              backgroundColor: '#6366f1',
              borderRadius: 4
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 450 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(14, 21, 38, 0.95)',
              callbacks: {
                afterBody: function (context) {
                  const idx = context[0].dataIndex;
                  const item = subStats[idx];
                  return `Total: ${formatVal(item.mean, 1)} ${unit} (Monsoon: ${item.monsoon_share.toFixed(1)}%)`;
                }
              }
            }
          },
          scales: {
            x: {
              stacked: true,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8' },
              title: { display: true, text: `Annual Rainfall (${unit})`, color: '#64748b' }
            },
            y: {
              stacked: true,
              grid: { display: false },
              ticks: { color: '#cbd5e1', font: { size: 10 } }
            }
          }
        }
      });
    }
  }

  // =========================================================================
  // 5. Tab 4: District-Wise Climatological Normals
  // =========================================================================
  function renderDistrictView() {
    updateDistrictLeaderboards();
    updateDistrictStateSummary();
    renderDistrictTable();
  }

  function updateDistrictLeaderboards() {
    const distData = state.data.districts_data;
    const unit = getUnitLabel();

    const topWet = document.getElementById('topWettestDistrictsList');
    const topDry = document.getElementById('topDriestDistrictsList');
    if (!topWet || !topDry) return;

    topWet.innerHTML = '';
    topDry.innerHTML = '';

    // Top 10 Wettest Districts in India
    distData.districts.slice(0, 10).forEach((d, idx) => {
      const el = document.createElement('div');
      el.className = 'ranking-item';
      el.innerHTML = `
        <div class="ranking-left">
          <div class="ranking-rank">${idx + 1}</div>
          <div>
            <div class="ranking-name">${d.district}</div>
            <div class="ranking-subtext">${d.state} &bull; SW Monsoon: ${formatVal(d.seasons['Jun-Sep'], 1)} ${unit}</div>
          </div>
        </div>
        <div class="ranking-val">${formatVal(d.annual, 1)} <span style="font-size: 0.72rem; color: var(--text-muted);">${unit}</span></div>
      `;
      topWet.appendChild(el);
    });

    // Top 10 Driest Districts in India
    distData.districts.slice(-10).reverse().forEach((d, idx) => {
      const el = document.createElement('div');
      el.className = 'ranking-item';
      el.innerHTML = `
        <div class="ranking-left">
          <div class="ranking-rank" style="background: rgba(245, 158, 11, 0.15); color: var(--amber-400);">${idx + 1}</div>
          <div>
            <div class="ranking-name">${d.district}</div>
            <div class="ranking-subtext">${d.state} &bull; SW Monsoon: ${formatVal(d.seasons['Jun-Sep'], 1)} ${unit}</div>
          </div>
        </div>
        <div class="ranking-val">${formatVal(d.annual, 1)} <span style="font-size: 0.72rem; color: var(--text-muted);">${unit}</span></div>
      `;
      topDry.appendChild(el);
    });
  }

  function updateDistrictStateSummary() {
    const distData = state.data.districts_data;
    const unit = getUnitLabel();

    if (state.activeState === 'ALL') {
      document.getElementById('stateSummaryInfo').textContent = 'Showing all 641 districts across India.';
      const wettest = distData.districts[0];
      const driest = distData.districts[distData.districts.length - 1];

      document.getElementById('stateWettestDistrictName').textContent = wettest.district;
      document.getElementById('stateWettestState').textContent = wettest.state;
      document.getElementById('stateWettestRainfall').textContent = `${formatVal(wettest.annual, 1)} ${unit}`;

      document.getElementById('stateDriestDistrictName').textContent = driest.district;
      document.getElementById('stateDriestState').textContent = driest.state;
      document.getElementById('stateDriestRainfall').textContent = `${formatVal(driest.annual, 1)} ${unit}`;
    } else {
      const summary = distData.state_summaries[state.activeState];
      if (summary) {
        document.getElementById('stateSummaryInfo').textContent = `${state.activeState}: ${summary.district_count} districts, Mean Annual: ${formatVal(summary.mean_annual, 1)} ${unit}`;
        document.getElementById('stateWettestDistrictName').textContent = summary.wettest_district.name;
        document.getElementById('stateWettestState').textContent = state.activeState;
        document.getElementById('stateWettestRainfall').textContent = `${formatVal(summary.wettest_district.annual, 1)} ${unit}`;

        document.getElementById('stateDriestDistrictName').textContent = summary.driest_district.name;
        document.getElementById('stateDriestState').textContent = state.activeState;
        document.getElementById('stateDriestRainfall').textContent = `${formatVal(summary.driest_district.annual, 1)} ${unit}`;
      }
    }
  }

  function getFilteredDistricts() {
    const distData = state.data.districts_data;
    let list = distData.districts;

    // Filter by state
    if (state.activeState !== 'ALL') {
      list = list.filter(d => d.state === state.activeState);
    }

    // Filter by search query
    if (state.districtSearch) {
      const q = state.districtSearch;
      list = list.filter(d => d.district.toLowerCase().includes(q) || d.state.toLowerCase().includes(q));
    }

    // Sort
    const col = state.districtSortCol;
    const dir = state.districtSortDir === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      let vA = a[col];
      let vB = b[col];

      if (col === 'Jun-Sep' || col === 'Mar-May' || col === 'Oct-Dec' || col === 'Jan-Feb') {
        vA = a.seasons[col] || 0;
        vB = b.seasons[col] || 0;
      }

      if (typeof vA === 'string') {
        return dir * vA.localeCompare(vB);
      }
      return dir * ((vA || 0) - (vB || 0));
    });

    return list;
  }

  function renderDistrictTable() {
    const tbody = document.getElementById('districtTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = getFilteredDistricts();
    const total = list.length;
    const unit = getUnitLabel();

    const startIdx = (state.districtPage - 1) * state.districtPageSize;
    const endIdx = Math.min(startIdx + state.districtPageSize, total);
    const pageItems = list.slice(startIdx, endIdx);

    // Update Pagination Display
    const totalPages = Math.max(1, Math.ceil(total / state.districtPageSize));
    document.getElementById('districtTableInfo').textContent = total === 0 ? 'No districts match your search.' : `Showing ${startIdx + 1} to ${endIdx} of ${total} districts`;
    document.getElementById('paginationPageNum').textContent = `Page ${state.districtPage} of ${totalPages}`;
    document.getElementById('btnPrevPage').disabled = state.districtPage <= 1;
    document.getElementById('btnNextPage').disabled = state.districtPage >= totalPages;

    pageItems.forEach(d => {
      const tr = document.createElement('tr');
      
      // Tier Badge based on Annual Normal
      let tierBadge = '<span class="kpi-badge badge-normal">Moderate</span>';
      if (d.annual > 2500) {
        tierBadge = '<span class="kpi-badge badge-excess">Heavy / Wet</span>';
      } else if (d.annual < 600) {
        tierBadge = '<span class="kpi-badge badge-scanty">Arid / Dry</span>';
      } else if (d.annual < 1000) {
        tierBadge = '<span class="kpi-badge badge-deficient">Semi-Arid</span>';
      }

      tr.innerHTML = `
        <td style="font-weight: 700; color: #38bdf8; font-family: var(--font-mono);">${d.all_india_rank}</td>
        <td style="font-weight: 600; color: #fff;">${d.district}</td>
        <td style="color: var(--text-secondary);">${d.state}</td>
        <td class="num-cell" style="font-weight: 700; color: #fff;">${formatVal(d.annual, 1)} ${unit}</td>
        <td class="num-cell">${formatVal(d.seasons['Jun-Sep'], 1)}</td>
        <td class="num-cell" style="color: var(--cyan-400);">${d.monsoon_share.toFixed(1)}%</td>
        <td class="num-cell">${formatVal(d.seasons['Mar-May'], 1)}</td>
        <td class="num-cell">${formatVal(d.seasons['Oct-Dec'], 1)}</td>
        <td class="num-cell">${formatVal(d.seasons['Jan-Feb'], 1)}</td>
        <td>${tierBadge}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // =========================================================================
  // 6. Tab 5: Predictive Modeling & Forecasting Studio
  // =========================================================================
  function updatePredictiveModel() {
    const hist = state.data.historical;
    const multiplier = state.activeUnit === 'cm' ? 0.1 : 1.0;
    const unit = getUnitLabel();

    // Determine target region series and baseline
    let series = [];
    let lpa = 0;
    let regression = null;
    let stdDev = 0;
    let cv = 0;
    let monthAvg = {};

    if (state.forecastRegion === 'ALL') {
      series = hist.national_timeseries;
      lpa = hist.national_lpa;
      regression = hist.national_regression;
      // Calculate National StdDev & CV
      const annVals = series.map(s => s.annual);
      const variance = annVals.reduce((acc, v) => acc + Math.pow(v - lpa, 2), 0) / annVals.length;
      stdDev = Math.sqrt(variance);
      cv = (stdDev / lpa) * 100;
      // Months
      const months = state.data.metadata.months;
      months.forEach(m => {
        monthAvg[m] = series.reduce((acc, s) => acc + (s.months[m] || 0), 0) / series.length;
      });
    } else {
      const prof = hist.subdivision_profiles[state.forecastRegion];
      if (prof) {
        series = prof.timeseries;
        lpa = prof.lpa;
        regression = prof.regression;
        stdDev = prof.std_dev;
        cv = prof.cv;
        monthAvg = prof.monthly_avg;
      }
    }

    if (!regression) return;

    // The historical dataset concludes in 2015 (115 continuous years: 1901-2015)
    const TERMINAL_YEAR = 2015;
    const targetYear = state.forecastYear;
    const horizon = targetYear - TERMINAL_YEAR; // Steps beyond historical data (h >= 1)
    const isSubdivision = state.forecastRegion !== 'ALL';

    // Model parameters
    const nObs = regression.n || series.length || 115;
    const xMean = regression.x_mean || 1958.0;
    const sumXSq = regression.sum_x_sq || 126730.0;
    const s_e = regression.s_e || regression.rmse || stdDev;
    const tCrit = 1.9812; // Two-tailed t_0.025 with df = N - 2 = 113

    let projectedAnnual = 0;
    let sePred = s_e;

    // 1. Model Projection
    if (state.forecastModel === 'OLS') {
      // Ordinary Least Squares (OLS) Linear Trend Extrapolation: y_hat = beta_0 + beta_1 * Year
      projectedAnnual = regression.intercept + regression.slope * targetYear;

      // Exact out-of-sample standard error of prediction:
      // SE_pred(t0) = s_e * sqrt(1 + 1/N + (t0 - x_bar)^2 / sum((t_i - x_bar)^2))
      const sampleDistance = Math.pow(targetYear - xMean, 2) / sumXSq;
      sePred = s_e * Math.sqrt(1 + (1 / nObs) + sampleDistance);

    } else if (state.forecastModel === 'ROLLING_MA') {
      // 10-Year Rolling Moving Average: Terminal decade baseline (2006-2015)
      const recent10 = series.filter(s => s.year >= 2006 && s.year <= 2015);
      projectedAnnual = recent10.reduce((acc, s) => acc + s.annual, 0) / (recent10.length || 10);
      
      // Prediction SE for sample mean forecast: SE_pred = s_e * sqrt(1 + 1/k)
      sePred = s_e * Math.sqrt(1 + (1 / (recent10.length || 10)));

    } else if (state.forecastModel === 'EXP_SMOOTH') {
      // Double Exponential Smoothing (Holt's Linear Trend): y_hat(T + h) = L_T + h * T_T
      let L_T = 0;
      let T_T = 0;
      
      if (state.forecastRegion === 'ALL' && hist.national_holt) {
        L_T = hist.national_holt.L_2015;
        T_T = hist.national_holt.T_2015;
      } else if (hist.subdivision_profiles[state.forecastRegion] && hist.subdivision_profiles[state.forecastRegion].holt_params) {
        L_T = hist.subdivision_profiles[state.forecastRegion].holt_params.L_2015;
        T_T = hist.subdivision_profiles[state.forecastRegion].holt_params.T_2015;
      } else {
        // Fallback computation
        const alpha = 0.2;
        const beta = 0.1;
        let sVal = series[0].annual;
        let bVal = series[1].annual - series[0].annual;
        for (let i = 1; i < series.length; i++) {
          const lastS = sVal;
          sVal = alpha * series[i].annual + (1 - alpha) * (sVal + bVal);
          bVal = beta * (sVal - lastS) + (1 - beta) * bVal;
        }
        L_T = sVal;
        T_T = bVal;
      }

      projectedAnnual = L_T + horizon * T_T;
      // Holt forecast variance growth over horizon h: SE_h = s_e * sqrt(1 + (h - 1) * 0.06)
      sePred = s_e * Math.sqrt(1 + Math.max(0, horizon - 1) * 0.06);
    }

    // 2. 95% Confidence / Prediction Interval: y_hat +/- t_crit * SE_pred
    const marginOfError = tCrit * sePred;
    const lowerCI = Math.max(0, projectedAnnual - marginOfError);
    const upperCI = projectedAnnual + marginOfError;

    // 3. Projected SW Monsoon (Jun-Sep) share
    const totalAnn = series.reduce((a, s) => a + s.annual, 0);
    const totalMon = series.reduce((a, s) => a + (s.seasons['Jun-Sep'] || 0), 0);
    const monsoonShareRatio = (lpa > 0 && totalAnn > 0) ? (totalMon / totalAnn) : 0.751;
    const projectedMonsoon = projectedAnnual * monsoonShareRatio;

    // 4. IMD Classification & Empirical Probability
    const predictedDeparture = ((projectedAnnual - lpa) / lpa) * 100;
    const imdStatus = getImdStatus(predictedDeparture, isSubdivision);

    // Historical empirical probability of this category over 1901-2015
    const catCount = series.filter(s => {
      const dep = ((s.annual - lpa) / lpa) * 100;
      return getImdStatus(dep, isSubdivision).label === imdStatus.label;
    }).length;
    const historicalProb = Math.round((catCount / series.length) * 100);

    // 5. Update UI Cards
    document.getElementById('forecastAnnualVal').textContent = `${formatVal(projectedAnnual, 1)} ${unit}`;
    document.getElementById('forecastAnnualCI').textContent = `95% CI: [${formatVal(lowerCI, 1)} – ${formatVal(upperCI, 1)}] ${unit} (±${formatVal(marginOfError, 1)})`;
    document.getElementById('forecastMonsoonVal').textContent = `${formatVal(projectedMonsoon, 1)} ${unit}`;
    document.getElementById('forecastMonsoonCI').textContent = `Est. ${(monsoonShareRatio * 100).toFixed(1)}% seasonal concentration`;

    const catEl = document.getElementById('forecastCategoryVal');
    catEl.textContent = `${imdStatus.label.toUpperCase()} MONSOON`;
    catEl.style.color = imdStatus.color;
    document.getElementById('forecastCategoryProb').textContent = `Empirical Category Probability: ${historicalProb}% (Historical ${series.length} Yrs)`;

    document.getElementById('forecastR2Val').textContent = `R² = ${regression.r2.toFixed(4)}`;
    document.getElementById('forecastRMSEVal').textContent = `sₑ (adj): ${formatVal(s_e, 1)} ${unit} (df = ${nObs - 2})`;

    // Summary Badges
    document.getElementById('modelSlopeBadge').textContent = `${(regression.slope * multiplier).toFixed(2)} ${unit}/yr`;
    document.getElementById('modelLpaBadge').textContent = `${formatVal(lpa, 1)} ${unit}`;
    document.getElementById('modelCvBadge').textContent = `${cv.toFixed(1)}%`;
    document.getElementById('modelStdDevBadge').textContent = `${formatVal(stdDev, 1)} ${unit}`;
    const horizonBadge = document.getElementById('modelHorizonBadge');
    if (horizonBadge) {
      horizonBadge.textContent = `+${horizon} yr (beyond 2015)`;
    }

    // Chart 7: Historical Trajectory + Out-of-Sample Forecast Horizon (to 2030)
    renderForecastHorizonChart(series, lpa, regression, targetYear, projectedAnnual, lowerCI, upperCI, s_e, xMean, sumXSq, nObs, tCrit);

    // Chart 8: Projected Monthly Curve (normalized to sum exactly to projectedAnnual)
    renderForecastMonthlyChart(monthAvg, projectedAnnual, lpa);
  }

  function renderForecastHorizonChart(series, lpa, regression, targetYear, projectedAnnual, lowerCI, upperCI, s_e, xMean, sumXSq, nObs, tCrit) {
    const ctx = document.getElementById('chartForecastHorizon');
    if (!ctx) return;
    if (charts.forecastHorizon) charts.forecastHorizon.destroy();

    const multiplier = state.activeUnit === 'cm' ? 0.1 : 1.0;
    const unit = getUnitLabel();

    // The historical dataset concludes in 2015
    const TERMINAL_YEAR = 2015;
    const histYears = series.map(s => s.year);
    const futureYears = [2016, 2018, 2020, 2022, 2024, 2026, 2028, 2030];
    const allLabels = histYears.concat(futureYears);

    // 1. Historical Observations (1901-2015): null for future years
    const histData = series.map(s => s.annual * multiplier).concat(futureYears.map(() => null));

    // 2. Out-of-Sample Model Projection (2016-2030): null for past years up to 2014, connects at 2015
    const modelProjectionData = allLabels.map(y => {
      if (y < TERMINAL_YEAR) return null;
      let pred = 0;
      if (state.forecastModel === 'OLS') {
        pred = regression.intercept + regression.slope * y;
      } else if (state.forecastModel === 'ROLLING_MA') {
        const recent10 = series.filter(s => s.year >= 2006 && s.year <= 2015);
        pred = recent10.reduce((acc, s) => acc + s.annual, 0) / (recent10.length || 10);
      } else {
        const horizon = y - TERMINAL_YEAR;
        const L_T = regression.intercept + regression.slope * TERMINAL_YEAR;
        pred = L_T + horizon * (regression.slope * 0.8);
      }
      return Number((pred * multiplier).toFixed(1));
    });

    // 3. Shaded 95% Confidence Bounds (Out-of-Sample 2015-2030)
    const upperCIBound = allLabels.map(y => {
      if (y < TERMINAL_YEAR) return null;
      let pred = regression.intercept + regression.slope * y;
      const se = (s_e || 118) * Math.sqrt(1 + (1 / nObs) + Math.pow(y - xMean, 2) / sumXSq);
      return Number(((pred + (tCrit || 1.981) * se) * multiplier).toFixed(1));
    });

    const lowerCIBound = allLabels.map(y => {
      if (y < TERMINAL_YEAR) return null;
      let pred = regression.intercept + regression.slope * y;
      const se = (s_e || 118) * Math.sqrt(1 + (1 / nObs) + Math.pow(y - xMean, 2) / sumXSq);
      return Math.max(0, Number(((pred - (tCrit || 1.981) * se) * multiplier).toFixed(1)));
    });

    // 4. Target Projection Marker at targetYear
    const targetIdx = allLabels.indexOf(targetYear);
    const targetPoints = allLabels.map((y, idx) => idx === targetIdx ? Number((projectedAnnual * multiplier).toFixed(1)) : null);

    charts.forecastHorizon = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: `Historical Observations 1901–2015 (${unit})`,
            data: histData,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            borderWidth: 1.5,
            fill: false,
            pointRadius: 1.5,
            tension: 0.1
          },
          {
            label: `Model Trajectory 2016–2030 (${unit})`,
            data: modelProjectionData,
            borderColor: '#f59e0b',
            borderWidth: 2.5,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 2,
            pointBackgroundColor: '#f59e0b'
          },
          {
            label: `95% Upper CI (${unit})`,
            data: upperCIBound,
            borderColor: 'rgba(245, 158, 11, 0.35)',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
            fill: false
          },
          {
            label: `95% Lower CI (${unit})`,
            data: lowerCIBound,
            borderColor: 'rgba(245, 158, 11, 0.35)',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
            fill: '-1', // Fill between upper and lower bounds
            backgroundColor: 'rgba(245, 158, 11, 0.08)'
          },
          {
            label: `Forecast Target (${targetYear})`,
            data: targetPoints,
            borderColor: '#ec4899',
            backgroundColor: '#ec4899',
            pointRadius: 7,
            pointHoverRadius: 9,
            pointStyle: 'triangle',
            showLine: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { size: 10 } }
          },
          tooltip: {
            backgroundColor: 'rgba(14, 21, 38, 0.95)',
            callbacks: {
              title: function (ctx) {
                const year = ctx[0].label;
                const isHist = Number(year) <= 2015;
                return `${year} [${isHist ? 'Historical Observation' : 'Model-Based Projection'}]`;
              },
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} ${unit}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', maxTicksLimit: 16 }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: { color: '#94a3b8' },
            title: { display: true, text: `Precipitation (${unit})`, color: '#64748b' }
          }
        }
      }
    });
  }

  function renderForecastMonthlyChart(monthAvg, projectedAnnual, lpa) {
    const ctx = document.getElementById('chartForecastMonthly');
    if (!ctx) return;
    if (charts.forecastMonthly) charts.forecastMonthly.destroy();

    const multiplier = state.activeUnit === 'cm' ? 0.1 : 1.0;
    const unit = getUnitLabel();
    const months = state.data.metadata.months;

    // 1. Historical baseline monthly mean (1901-2015)
    const baselineMonthly = months.map(m => Number(((monthAvg[m] || 0) * multiplier).toFixed(1)));
    const baselineSum = baselineMonthly.reduce((a, b) => a + b, 0);

    // 2. Normalized monthly distribution for the projection
    // Each month receives its exact historical proportion of the projected annual total:
    // w_m = monthAvg[m] / sum(monthAvg) => projected_m = w_m * projectedAnnual
    const projectedMonthly = months.map(m => {
      const weight = baselineSum > 0 ? ((monthAvg[m] || 0) * multiplier / baselineSum) : (1 / 12);
      const mVal = weight * (projectedAnnual * multiplier);
      return Number(mVal.toFixed(1));
    });

    charts.forecastMonthly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: `1901–2015 Historical Baseline (${unit})`,
            data: baselineMonthly,
            backgroundColor: 'rgba(99, 102, 241, 0.5)',
            borderColor: '#818cf8',
            borderWidth: 1.5,
            borderRadius: 4
          },
          {
            label: `Projected Monthly Forecast ${state.forecastYear} (${unit})`,
            data: projectedMonthly,
            backgroundColor: 'rgba(56, 189, 248, 0.75)',
            borderColor: '#38bdf8',
            borderWidth: 1.5,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: 'rgba(14, 21, 38, 0.95)',
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} ${unit}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: { color: '#94a3b8' },
            title: { display: true, text: `Precipitation (${unit})`, color: '#64748b' }
          }
        }
      }
    });
  }

  // =========================================================================
  // 7. Export Utilities
  // =========================================================================
  function exportCSV() {
    const series = getActiveTimeSeries();
    if (!series || series.length === 0) return;

    let csvContent = 'SUBDIVISION,YEAR,JAN,FEB,MAR,APR,MAY,JUN,JUL,AUG,SEP,OCT,NOV,DEC,ANNUAL,Jan-Feb,Mar-May,Jun-Sep,Oct-Dec,IMD_STATUS\n';
    const subName = state.activeSubdivision;

    series.forEach(s => {
      const row = [
        `"${subName}"`,
        s.year,
        s.months.JAN, s.months.FEB, s.months.MAR, s.months.APR, s.months.MAY, s.months.JUN,
        s.months.JUL, s.months.AUG, s.months.SEP, s.months.OCT, s.months.NOV, s.months.DEC,
        s.annual,
        s.seasons['Jan-Feb'], s.seasons['Mar-May'], s.seasons['Jun-Sep'], s.seasons['Oct-Dec'],
        `"${s.imd_status || 'Normal'}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rainfall_export_${subName.replace(/\s+/g, '_')}_${state.startYear}_${state.endYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const series = getActiveTimeSeries();
    const lpa = getActiveLPA();

    const payload = {
      project: 'India Rainfall Analytics & Predictive Dashboard',
      subdivision: state.activeSubdivision,
      year_range: `${state.startYear}-${state.endYear}`,
      lpa_baseline_mm: lpa,
      unit: state.activeUnit,
      record_count: series.length,
      observations: series
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rainfall_summary_${state.activeSubdivision.replace(/\s+/g, '_')}_${state.startYear}_${state.endYear}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // --- Helper Math ---
  function round(val, decimals = 1) {
    if (val === null || val === undefined || isNaN(val)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  // --- Boot Application ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
