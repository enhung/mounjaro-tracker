// PK parameters
const PK_PARAMS = {
    halfLifeHours: 120, // 5 days
    bioavailability: 0.8, // 80% F (Typical bioavailability for sc injections of large peptides)
    tMax: 48, // 48 hours to peak
};

const ke = Math.LN2 / PK_PARAMS.halfLifeHours;
// To find ka, we use tMax = ln(ka/ke) / (ka - ke)
// An approximate ka that yields ~48h tMax with ke ~ 0.005776 h^-1 is ka = 0.05 h^-1
const ka = 0.05;

// Default dosage matching the user's situation
// 4 weeks of 2.5mg, 5th week 5.0mg
const defaultDoses = [
    { id: 1, day: 0, amount: 2.5 },
    { id: 2, day: 7, amount: 2.5 },
    { id: 3, day: 14, amount: 2.5 },
    { id: 4, day: 21, amount: 2.5 },
    // First time trying 5.0mg, which caused uncomfortable side effects
    { id: 5, day: 28, amount: 5.0 }
];

let doses = [];

let chartInstance = null;

function loadState() {
    const savedDoses = localStorage.getItem('mounjaro_doses');
    if (savedDoses) {
        try {
            doses = JSON.parse(savedDoses);
        } catch (e) {
            doses = [...defaultDoses];
        }
    } else {
        doses = [...defaultDoses];
    }

    const savedSimDays = localStorage.getItem('mounjaro_simDays');
    if (savedSimDays) {
        const simDaysInput = document.getElementById('sim-days');
        if (simDaysInput) {
            simDaysInput.value = savedSimDays;
        }
    }
}

function saveState() {
    localStorage.setItem('mounjaro_doses', JSON.stringify(doses));
    const simDaysInput = document.getElementById('sim-days');
    if (simDaysInput) {
        localStorage.setItem('mounjaro_simDays', simDaysInput.value);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    renderDoses();
    updateSimulation();

    document.getElementById('add-dose-btn').addEventListener('click', addDose);
    document.getElementById('sim-days').addEventListener('input', updateSimulation);
});

function renderDoses() {
    const container = document.getElementById('doses-container');
    container.innerHTML = '';

    // Sort doses by day
    doses.sort((a, b) => a.day - b.day);

    doses.forEach((dose, index) => {
        const doseEl = document.createElement('div');
        doseEl.className = 'dose-item';
        doseEl.innerHTML = `
            <div class="form-group">
                <label>天數 (Day)</label>
                <input type="number" step="1" min="0" value="${dose.day}" data-id="${dose.id}" class="dose-day-input">
            </div>
            <div class="form-group">
                <label>劑量 (mg)</label>
                <input type="number" step="0.5" min="0" value="${dose.amount}" data-id="${dose.id}" class="dose-amount-input">
            </div>
            <div class="form-group" style="justify-content: flex-end;">
                <button class="btn btn-danger" onclick="removeDose(${dose.id})" title="移除"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(doseEl);
    });

    // Add event listeners to newly created inputs
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
    // Assume typical interval is 7 days, and keeping the latest dose amount or returning to 2.5
    const lastAmount = doses.length > 0 ? doses[doses.length - 1].amount : 2.5;

    doses.push({
        id: newId,
        day: lastDay + 7,
        amount: lastAmount
    });
    renderDoses();
    updateSimulation();
}

function removeDose(id) {
    doses = doses.filter(d => d.id !== id);
    renderDoses();
    updateSimulation();
}

// Expose to window for inline HTML onclick handler
window.removeDose = removeDose;

function updateDose(id, field, value) {
    const dose = doses.find(d => d.id == id);
    if (dose) {
        dose[field] = value;
        // Just update simulation, don't re-render list to prevent losing focus
        updateSimulation();
    }
}

// Calculate concentration at specific hour t since start
function calculateAmountAtHour(hour, doseEvents) {
    let totalAmount = 0;
    for (const dose of doseEvents) {
        const doseTime = dose.day * 24;
        if (hour >= doseTime) {
            const timeSinceDose = hour - doseTime;
            // Formula for amount in 1-compartment model
            // Amount = Dose * F * (ka / (ka - ke)) * (e^{-ke*t} - e^{-ka*t})
            const amount = dose.amount * PK_PARAMS.bioavailability * (ka / (ka - ke)) *
                (Math.exp(-ke * timeSinceDose) - Math.exp(-ka * timeSinceDose));
            totalAmount += amount;
        }
    }
    return totalAmount;
}

function updateSimulation() {
    if (typeof saveState === 'function') saveState(); // Automatically save on updates
    const simDaysInput = document.getElementById('sim-days').value;
    const simDays = parseInt(simDaysInput) || 60;
    const totalHours = simDays * 24;

    const labels = [];
    const dataPoints = [];

    let peakValue = 0;

    // Evaluate every 6 hours for smooth curve
    for (let h = 0; h <= totalHours; h += 6) {
        const day = h / 24;
        labels.push(day.toFixed(2));
        const amount = calculateAmountAtHour(h, doses);
        dataPoints.push(amount);

        if (amount > peakValue) {
            peakValue = amount;
        }
    }

    const currentAmount = dataPoints[dataPoints.length - 1] || 0;

    document.getElementById('stat-current').innerHTML = `${currentAmount.toFixed(2)} <span class="unit">mg</span>`;
    document.getElementById('stat-peak').innerHTML = `${peakValue.toFixed(2)} <span class="unit">mg</span>`;

    updateChart(labels, dataPoints);
}

function updateChart(labels, dataPoints) {
    const ctx = document.getElementById('pkChart').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    // Colors matching CSS theme
    const accentColor = '#58a6ff';
    const accentColorAlpha = 'rgba(88, 166, 255, 0.2)';

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '預估體內殘留量 (mg)',
                data: dataPoints,
                borderColor: accentColor,
                backgroundColor: accentColorAlpha,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
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
                    labels: { color: '#f0f6fc' }
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.9)',
                    titleColor: '#f0f6fc',
                    bodyColor: '#8b949e',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            return Math.round(context.raw * 100) / 100 + ' mg';
                        },
                        title: function (context) {
                            return 'Day ' + parseFloat(context[0].label).toFixed(1);
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: '天數 (Days)', color: '#8b949e' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#8b949e',
                        maxTicksLimit: 15,
                        callback: function (value, index, values) {
                            return Math.round(labels[index]);
                        }
                    }
                },
                y: {
                    title: { display: true, text: '藥物量 (mg)', color: '#8b949e' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#8b949e' },
                    beginAtZero: true
                }
            }
        }
    });
}
