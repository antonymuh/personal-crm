import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";

const noop = () => {};
const failure = new Error("Failed query: insert into contacts params: secret");

describe("error pages", () => {
  it.each([
    ["page error", ErrorPage],
    ["layout error", GlobalError],
  ])("%s speaks Russian and hides the technical error", (_, Page) => {
    const html = renderToStaticMarkup(
      <Page error={failure} reset={noop} retry={noop} />
    );

    expect(html).toContain("Что-то пошло не так");
    expect(html).toContain("Попробовать ещё раз");
    expect(html).toContain("Ко всем контактам");
    expect(html).not.toContain("Failed query");
    expect(html).not.toContain("secret");
  });

  it("layout error page is a whole Russian document", () => {
    const html = renderToStaticMarkup(
      <GlobalError error={failure} reset={noop} retry={noop} />
    );

    expect(html).toContain('<html lang="ru"');
  });
});
