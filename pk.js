// pk.js — Pharmacokinetic calculation module

const PK = (() => {
    const PARAMS = {
        halfLifeHours: 120, // 5 days
        bioavailability: 0.8, // 80% F
        tMax: 48, // 48 hours to peak
    };

    const ke = Math.LN2 / PARAMS.halfLifeHours;
    const ka = 0.05; // Approximate ka yielding ~48h tMax

    // Default dosage matching user's situation
    const defaultDoses = [
        { id: 1, day: 0, amount: 2.5 },
        { id: 2, day: 7, amount: 2.5 },
        { id: 3, day: 14, amount: 2.5 },
        { id: 4, day: 21, amount: 2.5 },
        { id: 5, day: 28, amount: 5.0 }
    ];

    /**
     * Calculate drug amount at specific hour since start
     * Uses one-compartment model with first-order absorption/elimination
     * Amount = Dose * F * (ka/(ka-ke)) * (e^{-ke*t} - e^{-ka*t})
     */
    function calculateAmountAtHour(hour, doseEvents) {
        let totalAmount = 0;
        for (const dose of doseEvents) {
            const doseTime = dose.day * 24;
            if (hour >= doseTime) {
                const timeSinceDose = hour - doseTime;
                const amount = dose.amount * PARAMS.bioavailability * (ka / (ka - ke)) *
                    (Math.exp(-ke * timeSinceDose) - Math.exp(-ka * timeSinceDose));
                totalAmount += amount;
            }
        }
        return totalAmount;
    }

    /**
     * Run full simulation, returning labels, dataPoints, peak, and residual
     */
    function simulate(doses, simDays) {
        const totalHours = simDays * 24;
        const labels = [];
        const dataPoints = [];
        let peakValue = 0;

        for (let h = 0; h <= totalHours; h += 6) {
            const day = h / 24;
            labels.push(day.toFixed(2));
            const amount = calculateAmountAtHour(h, doses);
            dataPoints.push(amount);
            if (amount > peakValue) peakValue = amount;
        }

        const residual = dataPoints[dataPoints.length - 1] || 0;
        return { labels, dataPoints, peakValue, residual };
    }

    return { PARAMS, defaultDoses, calculateAmountAtHour, simulate, ke, ka };
})();
