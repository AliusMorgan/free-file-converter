const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// طابور: LibreOffice يعمل بملف واحد في كل مرة لحماية الذاكرة
let queue = Promise.resolve();
function enqueue(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
}

function convertToPdf(inputPath) {
    return new Promise((resolve, reject) => {
        const args = [
            '--headless',
            '--norestore',
            '--nolockcheck',
            '-env:UserInstallation=file:///tmp/lo_profile',
            '--convert-to', 'pdf',
            '--outdir', outputDir,
            inputPath
        ];
        execFile('soffice', args, { timeout: 120000 }, (err) => {
            if (err) return reject(err);
            const base = path.basename(inputPath, path.extname(inputPath));
            const outPath = path.join(outputDir, base + '.pdf');
            if (fs.existsSync(outPath)) resolve(outPath);
            else reject(new Error('PDF was not produced'));
        });
    });
}

function safeDelete(...files) {
    for (const f of files) {
        try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
    }
}

function makeHandler(ext) {
    return async (req, res) => {
        if (!req.file) return res.status(400).send('No file uploaded.');

        const originalExt = path.extname(req.file.originalname).toLowerCase();
        if (originalExt !== ext) {
            safeDelete(req.file.path);
            return res.status(400).send(`Only ${ext} files are allowed.`);
        }

        const inputPath = req.file.path + ext; // LibreOffice يحتاج الامتداد
        let outPath = null;

        try {
            fs.renameSync(req.file.path, inputPath);
            outPath = await enqueue(() => convertToPdf(inputPath));
            res.download(outPath, 'converted.pdf', () => safeDelete(inputPath, outPath));
        } catch (error) {
            console.error('Conversion error:', error);
            safeDelete(req.file.path, inputPath, outPath);
            res.status(500).send('Error processing file.');
        }
    };
}

app.post('/api/word-to-pdf', upload.single('file'), makeHandler('.docx'));
app.post('/api/ppt-to-pdf', upload.single('file'), makeHandler('.pptx'));

// معالج أخطاء الرفع (مثل تجاوز الحجم)
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).send('File too large (max 20MB).');
    }
    console.error(err);
    res.status(500).send('Server error.');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
