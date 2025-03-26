import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source and destination directories
const srcDir = path.join(__dirname, 'dist/public');
const destDir = path.join(__dirname, 'dist');

// Function to copy files recursively
function copyFilesRecursively(srcDir, destDir) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Read all items in the source directory
  const items = fs.readdirSync(srcDir);

  // Process each item
  for (const item of items) {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      // Recursively copy subdirectories
      copyFilesRecursively(srcPath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Moving files from dist/public to dist...');
copyFilesRecursively(srcDir, destDir);
console.log('Post-build process completed successfully!');