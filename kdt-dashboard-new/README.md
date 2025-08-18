# KDT Dashboard - New Version

This is a comprehensive, feature-rich dashboard for analyzing K-Digital Training (KDT) data. It is a full-stack web application built with Next.js, React, TypeScript, and Tailwind CSS, using sophisticated charting libraries and a Supabase backend.

## 📂 Project Structure

- **`src/app/`**: The heart of the application, containing the UI for numerous analysis pages, including:
    - `yearly-analysis/`
    - `monthly-analysis/`
    - `institution-analysis/`
    - `course-analysis/`
    - `ncs-analysis/`
    - `employment-analysis/`
- **`src/pages/api/`**: Contains backend API endpoints built with Next.js API Routes.
- **`src/components/`**: A well-organized library of reusable React components for UI elements and dashboard widgets.
- **`src/lib/`** and **`src/utils/`**: These directories contain the core data processing logic (`data-utils.ts`), Supabase client setup (`supabaseClient.ts`), and other utility functions.
- **`IMPROVEMENTS.md`**: A very important technical document that outlines the main architectural challenge of the project and a detailed plan to solve it.
- **`server/`**: A standalone Node.js/Express server for a simple bulletin board feature. This is **not** part of the main KDT dashboard functionality.

## 🎯 Purpose of this Folder

This project is the most advanced attempt at creating a definitive dashboard for the KDT dataset. It aims to provide deep, multi-faceted insights into the data through a polished and interactive user interface.

## 📈 Current Status & Key Challenge

The dashboard is **functionally rich** on the frontend, with many different views and components already built.

However, the project has a significant architectural issue that impacts performance, as documented in `IMPROVEMENTS.md`:

- **Problem**: All heavy data processing (parsing CSVs, grouping data, calculating statistics) is currently performed **on the client-side** (in the user's browser).
- **Impact**: This will cause slow load times and a sluggish user experience, especially on large datasets.
- **Solution (Not Yet Implemented)**: The plan is to move this data processing to a **build-time script**. This script would pre-process the raw data and save it as static JSON files. The frontend would then fetch these small, ready-to-use files, resulting in a much faster and more responsive dashboard.

The `scripts/` folder intended for this solution is currently empty.

## 💡 Next Steps & Suggested Improvements

1.  **Implement the Pre-processing Script**: The highest priority is to execute the plan in `IMPROVEMENTS.md`. This involves:
    a. Creating a script in the `scripts/` folder.
    b. Moving the data-crunching logic from `src/lib/data-utils.ts` and `src/utils/data-utils.ts` into that script.
    c. Modifying the `package.json` build step to run this script before `next build`.
    d. Refactoring the frontend pages to fetch the pre-processed `.json` files from the `public/` directory.
2.  **Consolidate Data Utilities**: The data processing logic is currently split between `src/lib/data-utils.ts` and `src/utils/data-utils.ts`. This should be merged into a single, authoritative source of truth.
3.  **Update This README**: This file should be kept current with the project's status. A "How to Run" section should be added, and the purpose of the separate `server/` directory should be clearly explained.