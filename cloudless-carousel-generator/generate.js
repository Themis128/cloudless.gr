import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Programmatically builds a square LinkedIn Carousel PDF for cloudless.gr.
 * Designed to ingest custom image paths fetched from your local ComfyUI WSL instance.
 * 
 * @param {Object} payload The configuration maps for pages and text elements.
 * @param {string} outputPath Target location for the compiled PDF.
 */
export async function generateCarousel(payload, outputPath = './tmp/cloudless_carousel.pdf') {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const SLIDE_SIZE = 1080;
      const doc = new PDFDocument({
        size: [SLIDE_SIZE, SLIDE_SIZE],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      const colors = {
        background: '#0D0E11', // Deep tech slate surface
        textPrimary: '#FFFFFF',
        textSecondary: '#94A3B8',
        accentOrange: '#F38020', // Cloudflare core brand orange
      };

      const totalSlides = payload.slides.length;

       payload.slides.forEach((slide, index) => {
         const isFirst = index === 0;
         const isLast = index === totalSlides - 1;

           // Background: either image or solid color
           if (slide.imagePath && fs.existsSync(slide.imagePath)) {
             doc.image(slide.imagePath, 0, 0, { width: SLIDE_SIZE, height: SLIDE_SIZE });
             // Readability Layer: Draw a full-bleed overlay rectangle directly on top of the image
             doc.rect(0, 0, SLIDE_SIZE, SLIDE_SIZE).fillColor(colors.background).fillOpacity(0.55).fill();
           } else {
             // Fallback to solid background
             doc.rect(0, 0, SLIDE_SIZE, SLIDE_SIZE).fill(colors.background);
           }

         // --- Layout Headers ---
         if (!isFirst) {
           doc.fillColor(colors.textSecondary).font('Helvetica-Bold').fontSize(24).text('Cloudless', 100, 80, { continued: true })
              .font('Helvetica').fillColor(colors.accentOrange).text('  |  Serverless Frameworks');
           doc.moveTo(100, 130).lineTo(SLIDE_SIZE - 100, 130).lineWidth(2).strokeColor('#1E293B').stroke();
         }

        // --- Core Typography Engine ---
        if (isFirst) {
          doc.fillColor(colors.accentOrange).font('Helvetica-Bold').fontSize(36).text('⚡ cloudless.gr', 100, 250);
          doc.fillColor(colors.textPrimary).font('Helvetica-Bold').fontSize(72).lineGap(14).text(slide.title, 100, 340, { width: SLIDE_SIZE - 200 });
          doc.fillColor(colors.textSecondary).font('Helvetica').fontSize(34).text(slide.subtitle || '', 100, 680, { width: SLIDE_SIZE - 200 });
          doc.fillColor(colors.accentOrange).font('Helvetica-Bold').fontSize(26).text('Swipe Left  ▶', SLIDE_SIZE - 300, SLIDE_SIZE - 120, { width: 200, align: 'right' });
        } else if (isLast) {
          doc.fillColor(colors.accentOrange).font('Helvetica-Bold').fontSize(40).text(slide.overline || 'ELIMINATE CLOUD INFRASTRUCTURE BLOAT', 100, 280);
          doc.fillColor(colors.textPrimary).font('Helvetica-Bold').fontSize(78).lineGap(18).text(slide.title, 100, 360, { width: SLIDE_SIZE - 200 });
          
          // Draw CTA box
          doc.rect(100, 660, 640, 120).fill(colors.accentOrange);
          doc.fillColor(colors.background).font('Helvetica-Bold').fontSize(36).text('Book a Free 30-Min Audit', 140, 700, { width: 560, align: 'center' });
        } else {
          if (slide.stepNumber) {
            doc.fillColor(colors.accentOrange).font('Helvetica-Bold').fontSize(44).text(slide.stepNumber, 100, 210);
          }
          doc.fillColor(colors.textPrimary).font('Helvetica-Bold').fontSize(54).lineGap(12).text(slide.title, 100, 270, { width: SLIDE_SIZE - 200 });
          doc.fillColor(colors.textSecondary).font('Helvetica').fontSize(32).lineGap(12).text(slide.body, 100, 480, { width: SLIDE_SIZE - 200 });
        }

        // --- Footer Elements ---
        doc.fillColor(colors.textSecondary).font('Helvetica-Bold').fontSize(22).text('By Themistoklis Baltzakis', 100, SLIDE_SIZE - 100);
        doc.fillColor(colors.textSecondary).font('Helvetica').fontSize(22).text(`Page ${index + 1} of ${totalSlides}`, SLIDE_SIZE - 300, SLIDE_SIZE - 100, { width: 200, align: 'right' });

        if (index < totalSlides - 1) doc.addPage();
      });

      doc.end();
      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}

// Support command-line execution when invoked via system nodes
const args = process.argv.slice(2);
if (args.length > 0) {
  try {
    const inputPayload = JSON.parse(args[0]);
    const customOutput = args[1] || './tmp/cloudless_carousel.pdf';
    console.log('[GEN] Processing carousel blueprint data stream...');
    generateCarousel(inputPayload, customOutput)
      .then((path) => console.log(`[GEN_SUCCESS] Target file compiled: ${path}`))
      .catch((e) => { console.error('[GEN_FAIL]', e); process.exit(1); });
  } catch (err) {
    console.error('[GEN_INPUT_ERROR] Invalid JSON payload:', err.message);
    process.exit(1);
  }
}