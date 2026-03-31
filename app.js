// app.js — Main application controller
// Integrates: i18n, pk, exercise, export modules

let doses = [];
let chartInstance = null;

// ========== State Management ==========

function loadState() {
    // Doses
    const savedDoses = localStorage.getItem('mounjaro_doses');
    if (savedDoses) {
        try { doses = JSON.parse(savedDoses); }
        catch (e) { doses = [...PK.defaultDoses]; }
    } else {
        doses = [...PK.defaultDoses];
    }

    // Sim days
    const savedSimDays = localStorage.getItem('mounjaro_simDays');
    if (savedSimDays) {
        const el = document.getElementById('sim-days');
        if (el) el.value = savedSimDays;
    }

    // Threshold
    const savedThreshold = localStorage.getItem('mounjaro_threshold');
    if (savedThreshold) {
        const el = document.getElementById('risk-threshold');
        if (el) el.value = savedThreshold;
    }

    // Start date
    const savedStartDate = localStorage.getItem('mounjaro_startDate');
    if (savedStartDate) {
        const el = document.getElementById('start-date');
        if (el) el.value = savedStartDate;
    }

    // Exercise
    Exercise.load();
}

function saveState() {
    localStorage.setItem('mounjaro_doses', JSON.stringify(doses));
    const simEl = document.getElementById('sim-days');
    if (simEl) localStorage.setItem('mounjaro_simDays', simEl.value);
    const threshEl = document.getElementById('risk-threshold');
    if (threshEl) localStorage.setItem('mounjaro_threshold', threshEl.value);
    const startEl = document.getElementById('start-date');
    if (startEl && startEl.value) localStorage.setItem('mounjaro_startDate', startEl.value);
}

// ========== Tab Navigation ==========

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Deactivate all
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            // Activate selected
            btn.classList.add('active');
            const tabId = `tab-${btn.dataset.tab}`;
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// ========== i18n Integration ==========

function applyTranslations() {
    const t = I18n.t.bind(I18n);

    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = t(key);
        if (typeof translated === 'string') {
            el.textContent = translated;
        }
    });

    // Update risk-threshold title attribute
    const threshEl = document.getElementById('risk-threshold');
    if (threshEl) threshEl.title = t('simulation.thresholdTitle');

    // Update dynamic content
    renderDoses();
    renderDietLists();
    renderExerciseRecords();
    renderExerciseAdvice();
    updateStartDateInfo();
    updateSimulation();
}

function initLangSwitcher() {
    const select = document.getElementById('lang-select');
    if (!select) return;
    select.innerHTML = '';
    I18n.getSupportedLangs().forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang;
        opt.textContent = I18n.getLangLabel(lang);
        if (lang === I18n.getCurrentLang()) opt.selected = true;
        select.appendChild(opt);
    });
    select.addEventListener('change', async (e) => {
        await I18n.setLang(e.target.value);
    });
}

// ========== Start Date & Day Calculation ==========

function updateStartDateInfo() {
    const startInput = document.getElementById('start-date');
    const infoEl = document.getElementById('days-since-start');
    if (!startInput || !infoEl) return;

    const startDate = startInput.value;
    if (!startDate) {
        infoEl.textContent = '';
        return;
    }

    const start = new Date(startDate);
    const now = new Date();
    const diffMs = now - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 0) {
        infoEl.textContent = I18n.t('doses.daysSinceStart', { days: diffDays });
    } else {
        infoEl.textContent = I18n.t('doses.daysSinceStart', { days: 0 });
    }
}

function getActualDate(day) {
    const startInput = document.getElementById('start-date');
    if (!startInput || !startInput.value) return null;
    const start = new Date(startInput.value);
    const actual = new Date(start);
    actual.setDate(actual.getDate() + day);
    return actual;
}

function formatDate(date) {
    if (!date) return '';
    return date.toLocaleDateString(I18n.getCurrentLang() === 'de' ? 'de-DE' :
        I18n.getCurrentLang() === 'en' ? 'en-US' :
            I18n.getCurrentLang() === 'zh-CN' ? 'zh-CN' : 'zh-TW');
}

// ========== Dose Management ==========

function renderDoses() {
    const container = document.getElementById('doses-container');
    if (!container) return;
    container.innerHTML = '';

    const t = I18n.t.bind(I18n);
    doses.sort((a, b) => a.day - b.day);

    doses.forEach((dose) => {
        const doseEl = document.createElement('div');
        doseEl.className = 'dose-item';

        const actualDate = getActualDate(dose.day);
        const dateStr = actualDate ? formatDate(actualDate) : '';

        doseEl.innerHTML = `
            <div class="form-group">
                <label>${t('doses.dayLabel')}</label>
                <input type="number" step="1" min="0" value="${dose.day}" data-id="${dose.id}" class="dose-day-input">
                ${dateStr ? `<span class="dose-actual-date">${dateStr}</span>` : ''}
            </div>
            <div class="form-group">
                <label>${t('doses.amountLabel')}</label>
                <input type="number" step="0.5" min="0" value="${dose.amount}" data-id="${dose.id}" class="dose-amount-input">
            </div>
            <div class="form-group" style="justify-content: flex-end;">
                <button class="btn btn-danger" onclick="removeDose(${dose.id})" title="${t('doses.removeTitle')}"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(doseEl);
    });

    // Attach event listeners
    document.querySelectorAll('.dose-day-input').forEach(input => {
        input.addEventListener('change', (e) => updateDose(e.target.dataset.id, 'day', parseFloat(e.target.value)));
    });
    document.querySelectorAll('.dose-amount-input').forEach(input => {
        input.addEventListener('change', (e) => updateDose(e.target.dataset.id, 'amount', parseFloat(e.target.value)));
    });
}

function addDose() {
    const lastDay = doses.length > 0 ? Math.max(...doses.map(d => d.day)) : -7;
    const newId = doses.length > 0 ? Math.max(...doses.map(d => d.id)) + 1 : 1;
    const lastAmount = doses.length > 0 ? doses[doses.length - 1].amount : 2.5;

    doses.push({ id: newId, day: lastDay + 7, amount: lastAmount });
    renderDoses();
    updateSimulation();
}

function removeDose(id) {
    doses = doses.filter(d => d.id !== id);
    renderDoses();
    updateSimulation();
}
window.removeDose = removeDose;

function updateDose(id, field, value) {
    const dose = doses.find(d => d.id == id);
    if (dose) {
        dose[field] = value;
        updateSimulation();
    }
}

// ========== Simulation ==========

function updateSimulation() {
    saveState();
    const simDays = parseInt(document.getElementById('sim-days').value) || 60;
    const riskThreshold = parseFloat(document.getElementById('risk-threshold').value) || 4.0;

    const result = PK.simulate(doses, simDays);
    const thresholdPoints = result.labels.map(() => riskThreshold);

    document.getElementById('stat-current').innerHTML = `${result.residual.toFixed(2)} <span class="unit">mg</span>`;
    document.getElementById('stat-peak').innerHTML = `${result.peakValue.toFixed(2)} <span class="unit">mg</span>`;

    updateChart(result.labels, result.dataPoints, thresholdPoints);
}

function updateChart(labels, dataPoints, thresholdPoints) {
    const ctx = document.getElementById('pkChart').getContext('2d');

    if (chartInstance) chartInstance.destroy();

    const t = I18n.t.bind(I18n);
    const accentColor = '#58a6ff';
    const accentColorAlpha = 'rgba(88, 166, 255, 0.2)';
    const dangerColor = '#f85149';

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: t('simulation.chartLabelAmount'),
                    data: dataPoints,
                    borderColor: accentColor,
                    backgroundColor: accentColorAlpha,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: t('simulation.chartLabelThreshold'),
                    data: thresholdPoints,
                    borderColor: dangerColor,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#f0f6fc' } },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.9)',
                    titleColor: '#f0f6fc',
                    bodyColor: '#8b949e',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => Math.round(ctx.raw * 100) / 100 + ' mg',
                        title: (ctx) => t('simulation.chartTooltipDay', { day: parseFloat(ctx[0].label).toFixed(1) })
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: t('simulation.chartXAxis'), color: '#8b949e' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#8b949e',
                        maxTicksLimit: 15,
                        callback: (value, index) => Math.round(labels[index])
                    }
                },
                y: {
                    title: { display: true, text: t('simulation.chartYAxis'), color: '#8b949e' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#8b949e' },
                    beginAtZero: true
                }
            }
        }
    });
}

// ========== Diet Section ==========

function renderDietLists() {
    const t = I18n.t.bind(I18n);

    // Meal items
    const mealList = document.getElementById('diet-meal-list');
    if (mealList) {
        const items = t('diet.mealItems');
        mealList.innerHTML = '';
        if (Array.isArray(items)) {
            items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                mealList.appendChild(li);
            });
        }
    }

    // Supplement items
    const suppList = document.getElementById('diet-supplement-list');
    if (suppList) {
        const items = t('diet.supplementItems');
        suppList.innerHTML = '';
        if (Array.isArray(items)) {
            items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                suppList.appendChild(li);
            });
        }
    }
}

// ========== Exercise Section ==========

function renderExerciseRecords() {
    const container = document.getElementById('exercise-records');
    if (!container) return;
    container.innerHTML = '';

    const t = I18n.t.bind(I18n);
    const records = Exercise.getAll();
    const types = t('exercise.types');

    if (records.length === 0) {
        container.innerHTML = `<div class="empty-state">${t('exercise.noRecords')}</div>`;
    } else {
        records.forEach(rec => {
            const el = document.createElement('div');
            el.className = 'exercise-item';
            const typeName = (typeof types === 'object' && types[rec.type]) || rec.type;
            el.innerHTML = `
                <div class="form-group">
                    <label>${t('exercise.dateLabel')}</label>
                    <input type="date" value="${rec.date}" data-id="${rec.id}" class="ex-date-input">
                </div>
                <div class="form-group">
                    <label>${t('exercise.typeLabel')}</label>
                    <select data-id="${rec.id}" class="ex-type-input">
                        ${Object.keys(typeof types === 'object' ? types : {}).map(k =>
                `<option value="${k}" ${k === rec.type ? 'selected' : ''}>${types[k]}</option>`
            ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>${t('exercise.durationLabel')}</label>
                    <input type="number" min="1" value="${rec.duration}" data-id="${rec.id}" class="ex-duration-input">
                </div>
                <div class="form-group">
                    <label>${t('exercise.noteLabel')}</label>
                    <input type="text" value="${rec.note || ''}" data-id="${rec.id}" class="ex-note-input" placeholder="...">
                </div>
                <div class="form-group" style="justify-content: flex-end;">
                    <button class="btn btn-danger" onclick="removeExercise(${rec.id})" title="${t('exercise.removeTitle')}"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            container.appendChild(el);
        });

        // Attach listeners
        container.querySelectorAll('.ex-date-input').forEach(input => {
            input.addEventListener('change', (e) => { Exercise.update(parseInt(e.target.dataset.id), 'date', e.target.value); });
        });
        container.querySelectorAll('.ex-type-input').forEach(input => {
            input.addEventListener('change', (e) => { Exercise.update(parseInt(e.target.dataset.id), 'type', e.target.value); });
        });
        container.querySelectorAll('.ex-duration-input').forEach(input => {
            input.addEventListener('change', (e) => { Exercise.update(parseInt(e.target.dataset.id), 'duration', parseInt(e.target.value)); });
        });
        container.querySelectorAll('.ex-note-input').forEach(input => {
            input.addEventListener('change', (e) => { Exercise.update(parseInt(e.target.dataset.id), 'note', e.target.value); });
        });
    }

    updateExerciseSummary();
}

function updateExerciseSummary() {
    const summary = Exercise.getSummary();
    const totalEl = document.getElementById('ex-total-sessions');
    const minEl = document.getElementById('ex-total-minutes');
    if (totalEl) totalEl.textContent = summary.total;
    if (minEl) minEl.innerHTML = `${summary.totalMinutes} <span class="unit" data-i18n="exercise.minutesUnit">${I18n.t('exercise.minutesUnit')}</span>`;
}

function addExercise() {
    Exercise.add({
        date: new Date().toISOString().split('T')[0],
        type: 'cardio',
        duration: 30,
        note: ''
    });
    renderExerciseRecords();
}

function removeExercise(id) {
    Exercise.remove(id);
    renderExerciseRecords();
}
window.removeExercise = removeExercise;

function renderExerciseAdvice() {
    const list = document.getElementById('exercise-advice-list');
    if (!list) return;
    const items = I18n.t('exercise.adviceItems');
    list.innerHTML = '';
    if (Array.isArray(items)) {
        items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
        });
    }
}

// ========== Data Management ==========

function initDataManagement() {
    // Export JSON
    document.getElementById('export-json-btn').addEventListener('click', () => {
        DataManager.exportJSON();
        showDataStatus(I18n.t('dataManagement.exportSuccess'), 'success');
    });

    // Import JSON
    const importBtn = document.getElementById('import-json-btn');
    const fileInput = document.getElementById('import-file-input');
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!confirm(I18n.t('dataManagement.importConfirm'))) {
            fileInput.value = '';
            return;
        }
        try {
            await DataManager.importJSON(file);
            showDataStatus(I18n.t('dataManagement.importSuccess'), 'success');
            // Reload everything
            loadState();
            applyTranslations();
        } catch (err) {
            showDataStatus(I18n.t('dataManagement.importError'), 'error');
        }
        fileInput.value = '';
    });

    // Export PDF
    document.getElementById('export-pdf-btn').addEventListener('click', async () => {
        showDataStatus(I18n.t('dataManagement.pdfGenerating'), 'info');
        try {
            // Make sure simulation tab chart is rendered
            const canvas = document.getElementById('pkChart');
            await DataManager.exportPDF(canvas);
            showDataStatus(I18n.t('dataManagement.pdfSuccess'), 'success');
        } catch (err) {
            showDataStatus('PDF export error: ' + err.message, 'error');
        }
    });
}

function showDataStatus(msg, type) {
    const el = document.getElementById('data-status');
    if (!el) return;
    el.textContent = msg;
    el.className = `data-status ${type}`;
    setTimeout(() => { el.textContent = ''; el.className = 'data-status'; }, 4000);
}

// ========== Initialization ==========

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n first
    await I18n.init();
    initLangSwitcher();

    // Load all state
    loadState();

    // Initialize tab navigation
    initTabs();

    // Render everything
    applyTranslations();

    // Event listeners
    document.getElementById('add-dose-btn').addEventListener('click', addDose);
    document.getElementById('sim-days').addEventListener('input', updateSimulation);
    document.getElementById('risk-threshold').addEventListener('input', updateSimulation);
    document.getElementById('start-date').addEventListener('change', () => {
        saveState();
        updateStartDateInfo();
        renderDoses(); // re-render to update actual dates
    });
    document.getElementById('add-exercise-btn').addEventListener('click', addExercise);

    // Data management buttons
    initDataManagement();

    // i18n language change callback
    I18n.onChange((lang) => {
        // Update lang switcher selection
        const sel = document.getElementById('lang-select');
        if (sel) sel.value = lang;
        applyTranslations();
    });
});
