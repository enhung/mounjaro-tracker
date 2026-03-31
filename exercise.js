// exercise.js — Exercise tracking module

const Exercise = (() => {
    const STORAGE_KEY = 'mounjaro_exercises';
    let exercises = [];

    function load() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                exercises = JSON.parse(saved);
            } catch (e) {
                exercises = [];
            }
        }
        return exercises;
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(exercises));
    }

    function getAll() {
        return [...exercises].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    function add(record) {
        const newId = exercises.length > 0 ? Math.max(...exercises.map(e => e.id)) + 1 : 1;
        const entry = {
            id: newId,
            date: record.date || new Date().toISOString().split('T')[0],
            type: record.type || 'cardio',
            duration: record.duration || 30,
            note: record.note || ''
        };
        exercises.push(entry);
        save();
        return entry;
    }

    function remove(id) {
        exercises = exercises.filter(e => e.id !== id);
        save();
    }

    function update(id, field, value) {
        const entry = exercises.find(e => e.id === id);
        if (entry) {
            entry[field] = value;
            save();
        }
    }

    function getSummary() {
        const total = exercises.length;
        const totalMinutes = exercises.reduce((sum, e) => sum + (parseInt(e.duration) || 0), 0);
        return { total, totalMinutes };
    }

    function setAll(data) {
        exercises = data || [];
        save();
    }

    return { load, save, getAll, add, remove, update, getSummary, setAll };
})();
