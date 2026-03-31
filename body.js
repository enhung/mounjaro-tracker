// body.js — Body metrics tracking module (weight, BMI, body fat)

const BodyMetrics = (() => {
    const STORAGE_KEY_RECORDS = 'mounjaro_bodyRecords';
    const STORAGE_KEY_PROFILE = 'mounjaro_bodyProfile';

    // { heightCm: number }
    let profile = { heightCm: null };

    // [{ id, date, weightKg, bodyFatPct }]
    let records = [];

    // BMI classification thresholds (WHO standard)
    const BMI_ZONES = [
        { max: 18.5, label: 'bmi.underweight', color: '#58a6ff' },
        { max: 24.9, label: 'bmi.normal',      color: '#3fb950' },
        { max: 29.9, label: 'bmi.overweight',  color: '#e3b341' },
        { max: 34.9, label: 'bmi.obese1',      color: '#f0883e' },
        { max: Infinity, label: 'bmi.obese2',  color: '#f85149' }
    ];

    // BMI target range for chart reference lines
    const BMI_TARGET = { min: 18.5, max: 24.9 };

    function load() {
        try {
            const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
            if (savedProfile) profile = JSON.parse(savedProfile);
        } catch (e) { profile = { heightCm: null }; }
        try {
            const savedRecords = localStorage.getItem(STORAGE_KEY_RECORDS);
            if (savedRecords) records = JSON.parse(savedRecords);
        } catch (e) { records = []; }
    }

    function saveProfile() {
        localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    }

    function saveRecords() {
        localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
    }

    function setHeight(cm) {
        profile.heightCm = cm ? parseFloat(cm) : null;
        saveProfile();
    }

    function getHeight() {
        return profile.heightCm;
    }

    function calcBMI(weightKg, heightCm) {
        if (!weightKg || !heightCm) return null;
        const m = heightCm / 100;
        return weightKg / (m * m);
    }

    function getBMIZone(bmi) {
        if (bmi == null) return null;
        return BMI_ZONES.find(z => bmi < z.max) || BMI_ZONES[BMI_ZONES.length - 1];
    }

    // Weight (kg) needed to reach target BMI min/max given height
    function targetWeightRange(heightCm) {
        if (!heightCm) return null;
        const m = heightCm / 100;
        return {
            min: +(BMI_TARGET.min * m * m).toFixed(1),
            max: +(BMI_TARGET.max * m * m).toFixed(1)
        };
    }

    function getAll() {
        return [...records].sort((a, b) => a.date.localeCompare(b.date));
    }

    function add(rec) {
        const newId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
        const entry = {
            id: newId,
            date: rec.date || new Date().toISOString().split('T')[0],
            weightKg: rec.weightKg != null ? parseFloat(rec.weightKg) : null,
            bodyFatPct: rec.bodyFatPct != null ? parseFloat(rec.bodyFatPct) : null
        };
        records.push(entry);
        saveRecords();
        return entry;
    }

    function remove(id) {
        records = records.filter(r => r.id !== id);
        saveRecords();
    }

    function update(id, field, value) {
        const rec = records.find(r => r.id === id);
        if (rec) {
            rec[field] = value !== '' && value != null ? parseFloat(value) : null;
            saveRecords();
        }
    }

    function setAll(data) {
        records = data || [];
        saveRecords();
    }

    function getSummary() {
        const sorted = getAll();
        if (sorted.length === 0) return { count: 0, latest: null, first: null, lost: null, currentBMI: null };
        const first = sorted[0];
        const latest = sorted[sorted.length - 1];
        const lost = (first.weightKg != null && latest.weightKg != null)
            ? +(first.weightKg - latest.weightKg).toFixed(1) : null;
        const currentBMI = calcBMI(latest.weightKg, profile.heightCm);
        return { count: sorted.length, latest, first, lost, currentBMI };
    }

    return {
        load, setHeight, getHeight,
        calcBMI, getBMIZone, targetWeightRange, BMI_TARGET, BMI_ZONES,
        getAll, add, remove, update, setAll, getSummary,
        get profile() { return profile; }
    };
})();
