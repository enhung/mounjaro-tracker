// export.js — Data export/import module (JSON + PDF)

const DataManager = (() => {
    const EXPORT_VERSION = '3.0';

    // ========== JSON Export/Import ==========

    function exportJSON() {
        const data = {
            version: EXPORT_VERSION,
            exportDate: new Date().toISOString(),
            doses: JSON.parse(localStorage.getItem('mounjaro_doses') || '[]'),
            simDays: localStorage.getItem('mounjaro_simDays') || '60',
            threshold: localStorage.getItem('mounjaro_threshold') || '4.0',
            startDate: localStorage.getItem('mounjaro_startDate') || '',
            exercises: JSON.parse(localStorage.getItem('mounjaro_exercises') || '[]'),
            bodyRecords: JSON.parse(localStorage.getItem('mounjaro_bodyRecords') || '[]'),
            bodyProfile: JSON.parse(localStorage.getItem('mounjaro_bodyProfile') || '{"heightCm":null}'),
            lang: localStorage.getItem('mounjaro_lang') || 'zh-TW'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `mounjaro-backup-${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return true;
    }

    function importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    // Validate structure
                    if (!data.doses || !Array.isArray(data.doses)) {
                        reject(new Error('Invalid format: missing doses array'));
                        return;
                    }
                    // Apply data
                    localStorage.setItem('mounjaro_doses', JSON.stringify(data.doses));
                    if (data.simDays) localStorage.setItem('mounjaro_simDays', data.simDays);
                    if (data.threshold) localStorage.setItem('mounjaro_threshold', data.threshold);
                    if (data.startDate) localStorage.setItem('mounjaro_startDate', data.startDate);
                    if (data.exercises) localStorage.setItem('mounjaro_exercises', JSON.stringify(data.exercises));
                    if (data.bodyRecords) localStorage.setItem('mounjaro_bodyRecords', JSON.stringify(data.bodyRecords));
                    if (data.bodyProfile) localStorage.setItem('mounjaro_bodyProfile', JSON.stringify(data.bodyProfile));
                    if (data.lang) localStorage.setItem('mounjaro_lang', data.lang);
                    // Reload BodyMetrics in-memory state
                    if (typeof BodyMetrics !== 'undefined') BodyMetrics.load();
                    resolve(data);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('File read error'));
            reader.readAsText(file);
        });
    }

    // ========== PDF Export ==========

    // PDF always uses English labels — jsPDF's built-in fonts don't support
    // CJK glyphs, and German umlauts can also render incorrectly. Fetching the
    // 'en' locale separately guarantees clean Latin output for every UI language.
    async function exportPDF(chartCanvas) {
        // Load English locale for PDF labels
        let en = {};
        try {
            const resp = await fetch('locales/en.json');
            en = await resp.json();
        } catch (e) {
            console.warn('PDF: could not load en.json, falling back to I18n', e);
        }

        // t_en: resolve dot-notation key from en locale, fall back to I18n
        function t_en(key) {
            const parts = key.split('.');
            let v = en;
            for (const p of parts) {
                if (v && typeof v === 'object' && p in v) v = v[p];
                else return I18n.t(key);
            }
            return typeof v === 'string' || Array.isArray(v) ? v : I18n.t(key);
        }

        const { jsPDF } = window.jspdf || {};
        const JsPDFCtor = jsPDF || window.jsPDF;
        if (!JsPDFCtor) throw new Error('jsPDF not loaded');
        const doc = new JsPDFCtor('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageWidth - margin * 2;
        let y = margin;

        function addTitle(text, size) {
            doc.setFontSize(size || 16);
            doc.setTextColor(40, 40, 40);
            doc.text(String(text), margin, y);
            y += (size || 16) * 0.5 + 2;
        }

        function addText(text, size) {
            doc.setFontSize(size || 10);
            doc.setTextColor(80, 80, 80);
            const lines = doc.splitTextToSize(String(text), contentWidth);
            doc.text(lines, margin, y);
            y += lines.length * (size || 10) * 0.4 + 2;
        }

        function addLine() {
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, y, pageWidth - margin, y);
            y += 4;
        }

        function checkPageBreak(needed) {
            if (y + needed > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage();
                y = margin;
            }
        }

        // ---- Title ----
        addTitle(t_en('dataManagement.pdfTitle'), 18);
        addText(`${t_en('dataManagement.pdfGenDate')}: ${new Date().toLocaleDateString('en-US')}`, 10);
        addLine();

        // ---- Treatment Summary ----
        checkPageBreak(40);
        addTitle(t_en('dataManagement.pdfDoseSummary'), 14);
        const startDate = localStorage.getItem('mounjaro_startDate');
        if (startDate) {
            addText(`${t_en('dataManagement.pdfStartDate')}: ${startDate}`);
        }
        const doses = JSON.parse(localStorage.getItem('mounjaro_doses') || '[]');
        addText(`${t_en('dataManagement.pdfTotalDoses')}: ${doses.length}`);
        if (doses.length > 0) {
            const lastDose = [...doses].sort((a, b) => b.day - a.day)[0];
            addText(`${t_en('dataManagement.pdfCurrentDose')}: ${lastDose.amount} mg`);
        }
        addLine();

        // ---- Dose Records Table ----
        checkPageBreak(20 + doses.length * 8);
        addTitle(t_en('dataManagement.pdfDoseRecords'), 14);
        const sortedDoses = [...doses].sort((a, b) => a.day - b.day);
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const colDay = margin;
        const colDate = margin + 25;
        const colAmount = margin + 80;
        doc.text('Day', colDay, y);
        doc.text('Date', colDate, y);
        doc.text('Dose', colAmount, y);
        y += 5;
        doc.setTextColor(40, 40, 40);
        for (const dose of sortedDoses) {
            checkPageBreak(6);
            doc.text(`Day ${dose.day}`, colDay, y);
            if (startDate) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + dose.day);
                doc.text(d.toLocaleDateString('en-US'), colDate, y);
            } else {
                doc.text('-', colDate, y);
            }
            doc.text(`${dose.amount} mg`, colAmount, y);
            y += 5;
        }
        y += 3;
        addLine();

        // ---- Chart Screenshot ----
        if (chartCanvas) {
            checkPageBreak(80);
            addTitle(t_en('dataManagement.pdfConcentrationChart'), 14);
            try {
                const imgData = chartCanvas.toDataURL('image/png');
                const ratio = chartCanvas.height / chartCanvas.width;
                const imgWidth = contentWidth;
                const imgHeight = imgWidth * ratio;
                doc.addImage(imgData, 'PNG', margin, y, imgWidth, Math.min(imgHeight, 80));
                y += Math.min(imgHeight, 80) + 5;
            } catch (e) {
                addText('(Chart capture failed)', 9);
            }
            addLine();
        }

        // ---- Exercise Records ----
        const exercises = JSON.parse(localStorage.getItem('mounjaro_exercises') || '[]');
        if (exercises.length > 0) {
            checkPageBreak(20 + exercises.length * 8);
            addTitle(t_en('dataManagement.pdfExerciseRecords'), 14);
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text('Date', margin, y);
            doc.text('Type', margin + 30, y);
            doc.text('Duration', margin + 70, y);
            doc.text('Notes', margin + 100, y);
            y += 5;
            doc.setTextColor(40, 40, 40);
            const enExTypes = (en.exercise && en.exercise.types) || {};
            for (const ex of [...exercises].sort((a, b) => a.date.localeCompare(b.date))) {
                checkPageBreak(6);
                doc.text(ex.date, margin, y);
                const typeName = enExTypes[ex.type] || ex.type;
                doc.text(typeName, margin + 30, y);
                doc.text(`${ex.duration} min`, margin + 70, y);
                const noteText = (ex.note || '-').replace(/[^\x00-\x7F]/g, '?');
                const noteLines = doc.splitTextToSize(noteText, contentWidth - 100);
                doc.text(noteLines[0], margin + 100, y);
                y += 5;
            }
            y += 3;
            addLine();
        }

        // ---- Body Weight Records ----
        const bodyRecords = JSON.parse(localStorage.getItem('mounjaro_bodyRecords') || '[]');
        const bodyProfile = JSON.parse(localStorage.getItem('mounjaro_bodyProfile') || '{"heightCm":null}');
        if (bodyRecords.length > 0) {
            checkPageBreak(20 + bodyRecords.length * 8);
            addTitle(t_en('dataManagement.pdfBodyRecords'), 14);
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text('Date', margin, y);
            doc.text('Weight', margin + 35, y);
            doc.text('BMI', margin + 70, y);
            doc.text('Body Fat', margin + 90, y);
            y += 5;
            doc.setTextColor(40, 40, 40);
            const sortedBody = [...bodyRecords].sort((a, b) => a.date.localeCompare(b.date));
            for (const rec of sortedBody) {
                checkPageBreak(6);
                doc.text(rec.date, margin, y);
                doc.text(rec.weightKg != null ? `${rec.weightKg} kg` : '-', margin + 35, y);
                let bmiStr = '-';
                if (rec.weightKg && bodyProfile.heightCm) {
                    const m = bodyProfile.heightCm / 100;
                    bmiStr = (rec.weightKg / (m * m)).toFixed(1);
                }
                doc.text(bmiStr, margin + 70, y);
                doc.text(rec.bodyFatPct != null ? `${rec.bodyFatPct}%` : '-', margin + 90, y);
                y += 5;
            }
            y += 3;
            addLine();
        }

        // ---- Diet Reminders ----
        checkPageBreak(30);
        addTitle(t_en('dataManagement.pdfDietReminder'), 14);
        addText(`${t_en('diet.alcoholWarning')}: ${t_en('diet.alcoholText')}`, 9);
        addText(`${t_en('diet.nafBeerTitle')}: ${t_en('diet.nafBeerText')}`, 9);
        addLine();

        // ---- Disclaimer ----
        checkPageBreak(15);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const disclaimerLines = doc.splitTextToSize(t_en('dataManagement.pdfDisclaimer'), contentWidth);
        doc.text(disclaimerLines, margin, y);

        const dateStr = new Date().toISOString().split('T')[0];
        doc.save(`mounjaro-report-${dateStr}.pdf`);
        return true;
    }

    return { exportJSON, importJSON, exportPDF };
})();
