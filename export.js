// export.js — Data export/import module (JSON + PDF)

const DataManager = (() => {
    const EXPORT_VERSION = '2.0';

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
                    if (data.lang) localStorage.setItem('mounjaro_lang', data.lang);
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

    async function exportPDF(chartCanvas) {
        const t = I18n.t.bind(I18n);

        // Use html2canvas to capture the chart, then jsPDF to compose the report
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageWidth - margin * 2;
        let y = margin;

        // Helper: add text and advance y
        function addTitle(text, size) {
            doc.setFontSize(size || 16);
            doc.setTextColor(40, 40, 40);
            doc.text(text, margin, y);
            y += (size || 16) * 0.5 + 2;
        }

        function addText(text, size) {
            doc.setFontSize(size || 10);
            doc.setTextColor(80, 80, 80);
            const lines = doc.splitTextToSize(text, contentWidth);
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
        addTitle(t('dataManagement.pdfTitle'), 18);
        addText(`${t('dataManagement.pdfGenDate')}: ${new Date().toLocaleDateString()}`, 10);
        addLine();

        // ---- Treatment Summary ----
        checkPageBreak(40);
        addTitle(t('dataManagement.pdfDoseSummary'), 14);
        const startDate = localStorage.getItem('mounjaro_startDate');
        if (startDate) {
            addText(`${t('dataManagement.pdfStartDate')}: ${startDate}`);
        }
        const doses = JSON.parse(localStorage.getItem('mounjaro_doses') || '[]');
        addText(`${t('dataManagement.pdfTotalDoses')}: ${doses.length}`);
        if (doses.length > 0) {
            const lastDose = doses.sort((a, b) => b.day - a.day)[0];
            addText(`${t('dataManagement.pdfCurrentDose')}: ${lastDose.amount} mg`);
        }
        addLine();

        // ---- Dose Records Table ----
        checkPageBreak(20 + doses.length * 8);
        addTitle(t('dataManagement.pdfDoseRecords'), 14);
        const sortedDoses = [...doses].sort((a, b) => a.day - b.day);
        // Simple table
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const colDay = margin;
        const colDate = margin + 25;
        const colAmount = margin + 80;
        doc.text(t('doses.dayLabel'), colDay, y);
        doc.text(t('doses.actualDateLabel'), colDate, y);
        doc.text(t('doses.amountLabel'), colAmount, y);
        y += 5;
        doc.setTextColor(40, 40, 40);
        for (const dose of sortedDoses) {
            checkPageBreak(6);
            doc.text(`Day ${dose.day}`, colDay, y);
            if (startDate) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + dose.day);
                doc.text(d.toLocaleDateString(), colDate, y);
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
            addTitle(t('dataManagement.pdfConcentrationChart'), 14);
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
            addTitle(t('dataManagement.pdfExerciseRecords'), 14);
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(t('exercise.dateLabel'), margin, y);
            doc.text(t('exercise.typeLabel'), margin + 30, y);
            doc.text(t('exercise.durationLabel'), margin + 70, y);
            doc.text(t('exercise.noteLabel'), margin + 100, y);
            y += 5;
            doc.setTextColor(40, 40, 40);
            const exTypes = I18n.t('exercise.types');
            for (const ex of exercises.sort((a, b) => a.date.localeCompare(b.date))) {
                checkPageBreak(6);
                doc.text(ex.date, margin, y);
                const typeName = (typeof exTypes === 'object' && exTypes[ex.type]) || ex.type;
                doc.text(typeName, margin + 30, y);
                doc.text(`${ex.duration} min`, margin + 70, y);
                const noteLines = doc.splitTextToSize(ex.note || '-', contentWidth - 100);
                doc.text(noteLines[0], margin + 100, y);
                y += 5;
            }
            y += 3;
            addLine();
        }

        // ---- Diet Reminders ----
        checkPageBreak(30);
        addTitle(t('dataManagement.pdfDietReminder'), 14);
        addText(`⚠ ${t('diet.alcoholWarning')}: ${t('diet.alcoholText')}`, 9);
        addText(`${t('diet.nafBeerTitle')}: ${t('diet.nafBeerText')}`, 9);
        addLine();

        // ---- Disclaimer ----
        checkPageBreak(15);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const disclaimerLines = doc.splitTextToSize(t('dataManagement.pdfDisclaimer'), contentWidth);
        doc.text(disclaimerLines, margin, y);

        // Save
        const dateStr = new Date().toISOString().split('T')[0];
        doc.save(`mounjaro-report-${dateStr}.pdf`);
        return true;
    }

    return { exportJSON, importJSON, exportPDF };
})();
