#!/bin/bash

# Run the regular build
npm run build

# Run the post-build script to fix deployment output
node post-build.js

echo "Build completed. Files have been properly arranged for deployment."