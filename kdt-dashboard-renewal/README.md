# KDT Dashboard - Renewal

This project is the renewed and architecturally improved version of the K-Digital Training (KDT) dashboard. It is a high-performance web application built with Next.js, specifically designed to solve the performance bottlenecks identified in previous versions.

## 🚀 Key Architectural Improvement: Build-Time Data Pre-processing

The defining feature of this project is its data processing strategy. Unlike earlier versions that processed raw data in the user's browser, this application pre-processes all data during the **build step**.

Here's how it works:
1.  A Node.js script (`scripts/preprocess-data.mjs`) is executed before the application is built.
2.  This script fetches the raw KDT dataset (from a local CSV file).
3.  It performs all the heavy data processing in the Node.js environment: cleaning, parsing, grouping institutions, calculating statistics, and adjusting revenue figures.
4.  The final, clean, and aggregated data is saved as a set of static `.json` files in the `public/processed-data/` directory.
5.  The Next.js frontend application is then built. Its only job is to fetch these small, pre-computed JSON files and render them.

This approach results in a **dramatically faster and more responsive user experience**, as the browser does not have to perform any complex calculations.

## 📂 Project Structure

- **`scripts/preprocess-data.mjs`**: The core of the new architecture. This script handles all data transformation.
- **`src/data-utils-node.js`**: A library of data manipulation functions designed to be used by the Node.js script. This contains the "business logic" for the data.
- **`package.json`**: Contains the crucial `build` script: `"build": "npm run preprocess && next build"`. This command ensures the data is always processed before a new version of the site is built.
- **`public/processed-data/`**: This directory is where the output of the pre-processing script is stored. The live frontend application fetches its data from here.
- **`src/app/`**: Contains the Next.js frontend code (pages and components) that visualizes the pre-processed data.

## 🎯 Purpose of this Folder

This folder contains the most mature and well-architected version of the KDT dashboard. It serves as a blueprint for building performant, data-intensive web applications.

## 💡 Suggestions for Improvement

1.  **Flexible Data Source**: The path to the source CSV data is currently hardcoded in `scripts/preprocess-data.mjs`. This should be updated to use an environment variable or a configuration file to make the script more portable.
2.  **Add TypeScript**: The data processing scripts are written in JavaScript with JSDoc comments for types. Migrating them to TypeScript would improve code quality, type safety, and long-term maintainability.
3.  **Add Unit Tests**: The functions in `src/data-utils-node.js` are pure data transformation functions, making them perfect candidates for unit testing. Adding tests would ensure that changes to the logic do not introduce regressions.
