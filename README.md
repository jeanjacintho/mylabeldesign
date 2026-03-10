
#  MyLabelDesign
The "Figma" for Industrial Thermal Printers

---

## Overview
**MyLabelDesign** is an open source WYSIWYG visual editor for industrial label creation. It eliminates manual coding in PPLA, PPLB, and ZPL, allowing you to create complex layouts with a drag-and-drop interface.

---

## Problem
Industrial label development is traditionally slow and trial-and-error based, requiring manual coordinate adjustments and physical validation.

## Solution
A web/desktop platform where you design in millimeters and the software automatically converts to Dots (print points), ensuring what you see is what gets printed.

---

## Architecture (Monorepo)
TypeScript monorepo, ensuring consistency between the editor and conversion engines.

- **@apps/web-designer**: React + Konva.js interface for high-performance graphical manipulation.
- **@packages/core**: Business rules, data contracts (Schemas), and conversion utilities (mm ↔ dots).
- **@packages/converters**: Modular export engines for PPLA, PPLB, and ZPL.
- **@packages/ui**: Shared design system for industrial interface components.

---

## Main Features

- **Industrial Drag & Drop**: Precise positioning of text, barcodes (EAN13, Code128), and QR Codes.
- **Multi-DPI Support**: Native settings for 203dpi, 300dpi, and 600dpi printers.
- **Live Code Preview**: Real-time visualization of generated PPLA/ZPL code.
- **Dynamic Variables**: Placeholders for easy ERP integration (e.g., `{{BATCH}}`, `{{EXPIRY_DATE}}`).
- **Direct Printing**: Integration via TCP/IP Socket or local connection with thermal printers (Argox, Zebra, Datamax).

---

## Tech Stack

- **Language**: TypeScript
- **Frontend**: React.js + Tailwind CSS
- **Canvas**: Konva.js
- **Build Tool**: Vite + Turborepo
- **Package Manager**: pnpm
