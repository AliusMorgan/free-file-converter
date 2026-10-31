const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// إعداد مجلدات التخزين المؤقت في الجذر الحقيقي للسيرفر
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// إعداد Multer لاستقبال الملفات المرفوعة
const upload = multer({ dest: uploadDir });

// تقديم ملفات الواجهة الأمامية من نفس مجلد وجود server.js الحالي
app.use(express.static(__dirname));

// مسار معالجة وتحويل الملفات
app.post('/api/convert', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const { format } = req.body;
    const inputPath = req.file.path;
    const outputFilename = `converted_${Date.now()}.${format}`;
    const outputPath = path.join(outputDir, outputFilename);

    try {
        const mimeType = req.file.mimetype;

        // 1. معالجة وتغيير صيغ الصور (Sharp)
        if (mimeType.startsWith('image/')) {
            if (format === 'pdf') {
                const pdfDoc = await PDFDocument.create();
                const imageBytes = fs.readFileSync(inputPath);
                let image;
                if (mimeType === 'image/png') {
                    image = await pdfDoc.embedPng(imageBytes);
                } else {
                    image = await pdfDoc.embedJpg(imageBytes);
                }
                const page = pdfDoc.addPage([image.width, image.height]);
                page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                const pdfBytes = await pdfDoc.save();
                fs.writeFileSync(outputPath, pdfBytes);
            } else {
                await sharp(inputPath).toFormat(format).toFile(outputPath);
            }
        } 
        // 2. معالجة النصوص وتحويلها إلى PDF أو HTML
        else if (mimeType === 'text/plain' || req.file.originalname.endsWith('.txt') || req.file.originalname.endsWith('.md')) {
            const textContent = fs.readFileSync(inputPath, 'utf8');
            if (format === 'pdf') {
                const pdfDoc = await PDFDocument.create();
                const page = pdfDoc.addPage([600, 800]);
                page.drawText(textContent.substring(0, 2000), { x: 50, y: 750, size: 12, color: rgb(0, 0, 0) });
                const pdfBytes = await pdfDoc.save();
                fs.writeFileSync(outputPath, pdfBytes);
            } else if (format === 'html') {
                const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Converted Text</title></head><body><pre>${textContent}</pre></body></html>`;
                fs.writeFileSync(outputPath, htmlContent);
            } else {
                fs.writeFileSync(outputPath, textContent);
            }
        } else {
            fs.copyFileSync(inputPath, outputPath);
        }

        // إرسال الملف المحول للعميل ثم تنظيف الملفات المؤقتة بأمان
        res.download(outputPath, (err) => {
            try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (cleanupErr) {
                console.error('Cleanup error:', cleanupErr);
            }
        });

    } catch (error) {
        console.error('Conversion error details:', error);
        try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (cleanupErr) {}
        res.status(500).send('Error processing file.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
