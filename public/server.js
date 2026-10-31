const express = require('express');
const multer = require('multer');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// إعداد مجلدات التخزين المؤقت
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// إعداد Multer لاستقبال الملفات
const upload = multer({ dest: uploadDir });

// تقديم ملفات الواجهة الأمامية من نفس مجلد server.js الحالي
app.use(express.static(__dirname));

// مسار الصفحة الرئيسية صراحةً لضمان عدم ظهور Cannot GET /
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// مسار معالجة وتحويل النصوص وملفات الـ MD
app.post('/api/convert', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const { format } = req.body;
    const inputPath = req.file.path;
    const originalName = req.file.originalname;
    const outputFilename = `converted_${Date.now()}.${format}`;
    const outputPath = path.join(outputDir, outputFilename);

    try {
        const textContent = fs.readFileSync(inputPath, 'utf8');

        if (format === 'pdf') {
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([595.28, 841.89]); // A4
            
            page.drawText(textContent.substring(0, 1500), {
                x: 50,
                y: 780,
                size: 11,
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

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
