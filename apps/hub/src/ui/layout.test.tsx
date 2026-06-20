import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardGrid, ControlGrid, MeterBar, PageGrid, SegmentedControl, SplitWorkspace, Tabs } from ".";

describe("layout primitives", () => {
  it("renders a split workspace with labelled regions", () => {
    const html = renderToStaticMarkup(
      <SplitWorkspace
        sidebarLabel="List"
        detailLabel="Editor"
        sidebar={<button type="button">Hook</button>}
        detail={<p>Ready</p>}
      />,
    );

    expect(html).toContain("ui-split-workspace");
    expect(html).toContain('aria-label="List"');
    expect(html).toContain('aria-label="Editor"');
  });

  it("renders page and card grids with configurable column widths", () => {
    const html = renderToStaticMarkup(
      <PageGrid minColumnWidth="20rem">
        <CardGrid minColumnWidth="14rem">
          <article>One</article>
        </CardGrid>
      </PageGrid>,
    );

    expect(html).toContain("ui-page-grid");
    expect(html).toContain("ui-card-grid");
    expect(html).toContain("--ui-grid-min:20rem");
  });

  it("renders tabs and segmented controls with active state", () => {
    const items = [
      { id: "all", label: "All", count: 4 },
      { id: "active", label: "Active" },
    ];
    const html = renderToStaticMarkup(
      <>
        <Tabs ariaLabel="Views" items={items} activeId="all" onChange={() => undefined} />
        <SegmentedControl ariaLabel="Filters" items={items} activeId="active" onChange={() => undefined} />
      </>,
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders meters and control grids", () => {
    const html = renderToStaticMarkup(
      <ControlGrid>
        <MeterBar label="CPU" detail="42%" value={42} tone="success" />
      </ControlGrid>,
    );

    expect(html).toContain("ui-control-grid");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("width:42%");
  });
});
