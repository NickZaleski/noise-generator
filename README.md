# Noise Generator

A React web application for generating high-quality noise audio files (Brown, White, Pink, and Blue noise) in WAV format.

**Noise Generator is a project by Nick Zaleski — Product Manager, Musician, Entrepreneur**

- **Current company:** Alconost Inc.
- **Music projects:** beside the point, nick zaleski, dempo, carapils

## Features

- 🎵 Four noise types: Brown, White, Pink, and Blue noise
- ⏱️ Adjustable duration from 1 to 10 minutes
- 🎧 High-quality audio: 44.1 kHz sample rate, 16-bit WAV format
- 📥 Automatic download after generation
- 🎨 Modern, beautiful UI with smooth animations

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

### Build for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory. You can preview the production build with:

```bash
npm run preview
```

## Usage

1. Select a noise type (Brown, White, Pink, or Blue)
2. Adjust the duration slider (1-10 minutes)
3. Click "Generate"
4. The WAV file will automatically download when ready

## Noise Types

- **White Noise**: Equal energy per frequency (flat spectrum)
- **Pink Noise**: Equal energy per octave (1/f spectrum)
- **Brown Noise**: Low-frequency emphasis (1/f² spectrum)
- **Blue Noise**: High-frequency emphasis (f spectrum)

## Technology Stack

- React 18
- Vite
- Web Audio API (for noise generation)
- Pure JavaScript (no external audio libraries)

## License

MIT

