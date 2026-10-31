const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد مجلدات التخزين المؤقت
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// إعداد Multer لاستقبال الملفات المرفوعة
const upload = multer({ dest: uploadDir });

// تقديم ملفات الواجهة الأمامية من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

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
        // 2. معالجة النصوص وتحويلها إلى PDF (pdf-lib)
        else if (mimeType === 'text/plain' || req.file.originalname.endsWith('.txt')) {
            if (format === 'pdf') {
                const textContent = fs.readFileSync(inputPath, 'utf8');
                const pdfDoc = await PDFDocument.create();
                const page = pdfDoc.addPage([600, 800]);
                page.drawText(textContent.substring(0, 2000), { x: 50, y: 750, size: 12, color: rgb(0, 0, 0) });
                const pdfBytes = await pdfDoc.save();
                fs.writeFileSync(outputPath, pdfBytes);
            } else if (format === 'html') {
                const textContent = fs.readFileSync(inputPath, 'utf8');
                const htmlContent = `<!DOCTYPE html><html><body><pre>${textContent}</pre></body></html>`;
                fs.writeFileSync(outputPath, htmlContent);
            }
        } else {
            fs.copyFileSync(inputPath, outputPath);
        }

        // إرسال الملف المحول للعميل ثم تنظيف الملفات المؤقتة
        res.download(outputPath, (err) => {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        });

    } catch (error) {
        console.error('Conversion error:', error);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        res.status(500).send('Error processing file.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});