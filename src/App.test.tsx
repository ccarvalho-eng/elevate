import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the upload control and viewer placeholder", () => {
    render(<App />);

    expect(screen.getByLabelText("Upload blueprint")).toBeInTheDocument();
    expect(screen.getByText("3D viewer will render here")).toBeInTheDocument();
  });
});
