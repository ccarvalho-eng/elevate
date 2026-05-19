export function App() {
  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="upload-panel">
          <p className="eyebrow">Blueprint POV</p>
          <h1>Generate rough house perspectives from a blueprint.</h1>
          <p>
            Upload a PNG, JPG, or PDF plan and inspect a simple roof-off,
            exterior, front, side, or interior perspective.
          </p>
          <input aria-label="Upload blueprint" type="file" accept="image/png,image/jpeg,application/pdf" />
        </div>
        <div className="viewer-placeholder">3D viewer will render here</div>
      </section>
    </main>
  );
}
