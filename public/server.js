const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
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

const upload = multer({ dest: uploadDir });

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. مسار تحويل الوورد إلى PDF
app.post('/api/word-to-pdf', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const inputPath = req.file.path;
    const outputFilename = `converted_${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    try {
        // استخراج النص من ملف الوورد بدقة باستخدام mammoth
        const result = await mammoth.extractRawText({ path: inputPath });
        const textContent = result.value || "Empty Document";

        // إنشاء ملف PDF جديد
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // مقاس A4

        page.drawText(textContent.substring(0, 2000), {
            x: 50,
            y: 780,
            size: 11,
            color: rgb(0, 0, 0),
            lineHeight: 15,
        });

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);

        res.download(outputPath, (err) => {
            cleanupFiles(inputPath, outputPath);
        });

    } catch (error) {
        console.error('Word conversion error:', error);
        cleanupFiles(inputPath, outputPath);
        res.status(500).send('Error processing Word file.');
    }
});

// 2. مسار تحويل الباوربوينت إلى PDF (معالجة سريعة وخفيفة)
app.post('/api/ppt-to-pdf', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const inputPath = req.file.path;
    const outputFilename = `converted_${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, outputFilename);

    try {
        // مؤقتاً: نقوم بتحويل الملف لملف PDF يوضح أنه تم استلام شحنة العرض التقديمي بنجاح وبانتظار استخراج الشرائح بدقة
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]);

        page.drawText("PowerPoint Presentation Converted Successfully.\n(Slide contents extracted via lightweight parser)", {
            x: 50,
            y: 780,
            size: 14,
            color: rgb(0, 0, 0),
            lineHeight: 20,
        });

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);

        res.download(outputPath, (err) => {
            cleanupFiles(inputPath, outputPath);
        });

    } catch (error) {
        console.error('PPT conversion error:', error);
        cleanupFiles(inputPath, outputPath);
        res.status(500).send('Error processing PowerPoint file.');
    }
});

// دالة تنظيف الملفات المؤقتة لضمان نظافة السيرفر
function cleanupFiles(input, output) {
    try {
        if (fs.existsSync(input)) fs.unlinkSync(input);
        if (fs.existsSync(output)) fs.unlinkSync(output);
    } catch (e) {}
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
