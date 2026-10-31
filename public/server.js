// مسار معالجة وتحويل الملفات النصية والوثائق
app.post('/api/convert', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const { format } = req.body;
    const inputPath = req.file.path;
    const originalName = req.file.originalname;
    const fileExt = path.extname(originalName).toLowerCase();
    const outputFilename = `converted_${Date.now()}.${format}`;
    const outputPath = path.join(outputDir, outputFilename);

    try {
        let textContent = '';

        // قراءة الملف بحسب نوعه
        if (fileExt === '.txt' || fileExt === '.md') {
            textContent = fs.readFileSync(inputPath, 'utf8');
        } else {
            // كحل احتياطي آمن للملفات الأخرى، نقرأها كنص إن أمكن أو نضع تنبيه
            textContent = fs.readFileSync(inputPath, 'utf8').replace(/[^\x20-\x7E\u0600-\u06FF\s]/g, '');
        }

        if (format === 'pdf') {
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([595.28, 841.89]); // مقاس A4
            
            // كتابة المحتوى بشكل آمن داخل ملف الـ PDF
            page.drawText(textContent.substring(0, 1200), {
                x: 50,
                y: 780,
                size: 10,
                color: rgb(0, 0, 0),
            });

            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(outputPath, pdfBytes);
        } else if (format === 'html') {
            const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Converted Document</title></head><body style="font-family:sans-serif; padding:20px;"><pre style="white-space: pre-wrap;">${textContent}</pre></body></html>`;
            fs.writeFileSync(outputPath, htmlContent);
        } else {
            fs.writeFileSync(outputPath, textContent);
        }

        // إرسال الملف للعميل وتنظيف الملفات المؤقتة
        res.download(outputPath, (err) => {
            try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (e) {}
        });

    } catch (error) {
        console.error('Conversion error:', error);
        try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (e) {}
        res.status(500).send('Error processing file.');
    }
});
