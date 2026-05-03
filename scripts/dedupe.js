import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to data directory
const DATA_DIR = path.join(__dirname, '../src/store/data');

/**
 * Deduplicate a single JSON file
 * @param {string} filePath 
 */
const dedupeFile = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        if (!data.questions || !Array.isArray(data.questions)) {
            console.log(`[${path.basename(filePath)}] Skipped (no questions array).`);
            return;
        }

        const originalCount = data.questions.length;
        const seen = new Map();
        const uniqueQuestions = [];

        for (const q of data.questions) {
            // Normalize text for comparison: trim and collapse multiple spaces
            const qText = q.questiontext ? q.questiontext.trim().replace(/\s+/g, ' ') : '';
            const aText = q.answer ? q.answer.trim().replace(/\s+/g, ' ') : '';
            
            // Unique key for deduplication
            const key = `${qText}|||${aText}`;

            if (!seen.has(key)) {
                seen.set(key, true);
                uniqueQuestions.push(q);
            }
        }

        const duplicatesRemoved = originalCount - uniqueQuestions.length;

        if (duplicatesRemoved > 0) {
            data.questions = uniqueQuestions;
            
            // Update metadata.total if it exists
            if (data.metadata) {
                data.metadata.total = uniqueQuestions.length;
            }

            // Write back to file with 4-space indentation
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
            console.log(`[${path.basename(filePath)}] Removed ${duplicatesRemoved} duplicates. Final count: ${uniqueQuestions.length}`);
        } else {
            console.log(`[${path.basename(filePath)}] No duplicates found.`);
        }
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err.message);
    }
};

/**
 * Main execution
 */
const main = () => {
    if (!fs.existsSync(DATA_DIR)) {
        console.error(`Directory not found: ${DATA_DIR}`);
        return;
    }

    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    
    if (files.length === 0) {
        console.log("No JSON files found in data directory.");
        return;
    }

    console.log(`Found ${files.length} JSON files. Starting deduplication...`);
    files.forEach(file => {
        dedupeFile(path.join(DATA_DIR, file));
    });
    console.log("Done!");
};

main();
