<div align="center">
  <h1>Elevate—Blueprints to 3D</h1>
  <img 
    width="420" 
    alt="Elevate Logo" 
    src="https://github.com/user-attachments/assets/1eec6f73-aed7-4001-8091-1e0bd40acc35" 
  />

  <p>
    Experimental blueprint-to-3D reference app.
  </p>

  <p>
    <a href="https://github.com/ccarvalho-eng/elevate/actions/workflows/ci.yml">
      <img 
        alt="CI" 
        src="https://github.com/ccarvalho-eng/elevate/actions/workflows/ci.yml/badge.svg" 
      />
    </a>
    <img 
      alt="TypeScript Strict" 
      src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" 
    />
    <img 
      alt="React 18" 
      src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" 
    />
    <img 
      alt="Three.js" 
      src="https://img.shields.io/badge/Three.js-3D-111111?logo=three.js&logoColor=white" 
    />
    <img 
      alt="License Apache 2.0" 
      src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" 
    />
  </p>
</div>

Elevate is a local web app for turning a house blueprint into rough, interactive 3D perspective views. It is not CAD software; the goal is a fast spatial preview from a floor plan.

## Project Status

Elevate was an experiment in converting 2D blueprints into approximate interactive 3D views with browser-based computer vision and Three.js. This repository is archived and no longer actively maintained, but it can still serve as a reference for anyone interested in continuing this direction.

The most useful parts to build on are the upload normalization flow, deterministic blueprint extraction pipeline, non-AI structural filtering, scale-aware model generation, and React Three Fiber viewer. The output is intentionally approximate and should be treated as a spatial preview, not a CAD or construction model.

## What It Does

- Accepts PNG, JPG, JPEG, and PDF blueprints.
- Validates uploads using file signatures and size limits.
- Renders PDF page 1 into an image canvas.
- Extracts rough wall geometry from high-contrast floor plans.
- Filters likely furniture, dimension lines, and disconnected annotations before modeling.
- Collapses close double-line wall strokes into structural centerlines.
- Sizes the floor from detected wall bounds and rescales tiny footprints to avoid over-tall walls.
- Converts the plan into a simple 3D wall/floor model.
- Provides preset views: roof-off, exterior, front, side, and interior.

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Quality Gates

```bash
npm run format:check
npm run lint
npm test
npm run build
npm run e2e
```

Run everything:

```bash
npm run ci
```

## Current Limits

- Best results come from clean, high-contrast one-story floor plans.
- The model is approximate and intended for visual perspective only.
- Roof modeling, furniture, construction details, accounts, sharing, and CAD export are out of scope for V1.

## License

Elevate is licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
