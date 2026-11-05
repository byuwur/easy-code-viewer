/*
 * File: tests/rendering.cjs
 * Desc: CODE library contracts using local renderer assets; playground checks live in playground.cjs.
 */

/* --- DEPENDENCIES --- */
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");

/* --- THEME FIXTURES --- */
// Caller-provided legacy stylesheets reuse the canonical palettes without distribution files.
const legacyThemeCSS = (theme) => {
  const css = require("node:fs").readFileSync(path.join(__dirname, "../code.css"), "utf8");
  const section = css.split(`/* --- ${theme.toUpperCase()} --- */`)[1];
  return `.byCODEdocument {${section.match(/\{([\s\S]*?)\}/)[1]}}`;
};

/* --- STANDALONE RENDERER --- */
test("CODE standalone browser contracts", async (t) => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
  try {
    const page = await browser.newPage();
    const errors = [],
      requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/^https?:/.test(request.url()) && !request.url().startsWith("http://viewer.test/")) requests.push(request.url());
    });
    // This generated host exercises the library without reading the playground's index.html.
    await page.route("http://viewer.test/**", (route) => {
      const filename = new URL(route.request().url()).pathname.slice(1);
      if (/^code\.(light|dark)\.css$/.test(filename)) return route.fulfill({ body: legacyThemeCSS(filename.includes(".dark.css") ? "dark" : "light"), contentType: "text/css" });
      if (!filename || filename === "fixture.html")
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="code.css"><script src="code.js"></script><div id="viewer" data-theme="light"></div>'
        });
      return route.fulfill({ path: path.join(__dirname, "..", filename), contentType: filename.endsWith(".css") ? "text/css" : "text/javascript" });
    });
    await page.goto("http://viewer.test/fixture.html");
    await page.evaluate(
      async ({ source, second, options }) => {
        await byCODEviewer(document.getElementById("viewer"), source, options).ready;
      },
      {
        source: '// Source stays source.\nconst viewer = document.getElementById("viewer");\nconst message = `Hello, ${name}!`;\nif (viewer) {\n  console.log(message);\n}\n',
        options: { fontSizeControls: true, language: "javascript", languageSelect: true, lineNumbers: true, wordWrap: false }
      }
    );
    await page.waitForFunction(() => document.getElementById("viewer")?.getAttribute("aria-busy") !== "true" && typeof window.byCODEviewer === "function");
    await page.evaluate(() => {
      window.root = document.getElementById("viewer");
      window.copies = [];
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value) => copies.push(value) } });
    });
    await t.test("themes, copy, font size, and responsive controls", async () => {
      assert.equal(await page.locator("#viewer [role=alert]:visible").count(), 0);
      await page.locator(".byVIEWcopy").click();
      assert.equal(await page.evaluate(() => typeof copies.at(-1)), "string");
      await page.getByRole("button", { name: "Switch to dark theme" }).click();
      await page.waitForFunction(() => getComputedStyle(root).backgroundColor === "rgb(39, 40, 34)");
      await page.getByRole("button", { name: "Increase text size" }).click();
      assert.equal(await page.evaluate(() => root.style.fontSize), "1.125rem");
      await page.setViewportSize({ width: 320, height: 640 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.setViewportSize({ width: 1100, height: 800 });
      await page.getByRole("button", { name: "Reset text size" }).click();
    });
    await t.test("clipboard denial is reported", async () => {
      await page.evaluate(() => {
        navigator.clipboard.writeText = async () => {
          throw new Error("denied");
        };
      });
      await page.locator(".byVIEWcopy").click();
      assert.equal(await page.locator(".byVIEWcopy").textContent(), "Failed");
      await page.evaluate(() => {
        navigator.clipboard.writeText = async (value) => copies.push(value);
      });
    });

    await t.test("highlight fragment works without mounting a viewer and preserves exact source", async () => {
      const isolated = await browser.newPage();
      await isolated.addStyleTag({ path: path.join(__dirname, "../code.css") });
      await isolated.addScriptTag({ path: path.join(__dirname, "../code.js") });
      const result = await isolated.evaluate(() => {
        const source = '<img src=x onerror="window.injected=1">\r\n& <script>bad()</script>';
        const fragment = byCODEviewer.highlight(source, "html");
        const exact = fragment.textContent === source;
        const kind = fragment instanceof DocumentFragment;
        fragment.firstElementChild.dataset.theme = "dark";
        document.body.appendChild(fragment);
        return {
          exact,
          kind,
          safe: !document.querySelector("img, script[src]"),
          injected: Boolean(window.injected),
          styles: Boolean(document.getElementById("byCODEstyles")),
          theme: getComputedStyle(document.querySelector(".byCODEhighlight")).getPropertyValue("--by-code-string").trim()
        };
      });
      assert.deepEqual(result, { exact: true, kind: true, safe: true, injected: false, styles: false, theme: "#e6db74" });
      await isolated.close();
    });
    await t.test("framed fragments preserve source, independent options, and lexical context", async () => {
      const isolated = await browser.newPage({ viewport: { width: 320, height: 640 } });
      try {
        await isolated.addStyleTag({ path: path.join(__dirname, "../code.css") });
        await isolated.addScriptTag({ path: path.join(__dirname, "../code.js") });
        const result = await isolated.evaluate(() => {
          const source = "/* first\r\nsecond */\r\n\r\nconst text = `first\r\nsecond`;\r\n";
          const cases = [];
          for (const lineNumbers of [false, true]) {
            for (const statusBar of [false, true]) {
              const fragment = byCODEviewer.highlight(source, "js", { lineNumbers, statusBar });
              const wrapper = fragment.firstElementChild;
              cases.push({
                exact: fragment.textContent === source,
                framed: wrapper.classList.contains("byCODEblock"),
                lines: wrapper.querySelectorAll(".byCODEline").length,
                numbers: [...wrapper.querySelectorAll(".byCODElineNumber")].map((number) => [number.dataset.line, number.textContent, number.getAttribute("aria-hidden")]),
                status: wrapper.querySelector(".byCODEstatus")?.dataset.label ?? null,
                comments: [...wrapper.querySelectorAll(".byCODEcomment")]
                  .map((token) => token.textContent)
                  .join("")
                  .replace(/\r\n/g, ""),
                strings: [...wrapper.querySelectorAll(".byCODEstring")]
                  .map((token) => token.textContent)
                  .join("")
                  .replace(/\r\n/g, "")
              });
            }
          }
          const empty = byCODEviewer.highlight("", "js", { statusBar: true });
          const plain = byCODEviewer.highlight("const value = 1;", "js", { highlighting: false, statusBar: true });
          const host = document.createElement("pre");
          host.style.cssText = "margin:0;max-width:100%;--by-view-bg:#123456;--by-code-keyword:#abcdef";
          host.append(byCODEviewer.highlight(Array.from({ length: 101 }, () => "const " + "long".repeat(40)).join("\n"), "js", { lineNumbers: true, statusBar: true }));
          document.body.append(host);
          const block = host.firstElementChild;
          const sizes = [1, 1.5].map((scale) => {
            host.style.fontSize = `${scale}rem`;
            const rows = [...host.querySelectorAll(".byCODEline")];
            return {
              contained: document.documentElement.scrollWidth <= innerWidth,
              overflow: block.scrollWidth > block.clientWidth,
              continuous: rows.slice(1).every((row, index) => Math.abs(row.getBoundingClientRect().top - rows[index].getBoundingClientRect().bottom) < 0.1),
              numberWidth: host.querySelector(".byCODElineNumber").getBoundingClientRect().width,
              digits: host.querySelector(".byCODElines").style.getPropertyValue("--by-code-line-digits")
            };
          });
          const inherited = [getComputedStyle(block).backgroundColor, getComputedStyle(block.querySelector(".byCODEkeyword")).color];
          block.classList.add("dark");
          block.dataset.theme = "high-contrast";
          return {
            cases,
            empty: [empty.textContent, empty.querySelectorAll(".byCODEline").length, empty.querySelector(".byCODEstatus").dataset.label],
            plain: [plain.textContent, plain.querySelectorAll(".byCODEtoken").length, plain.querySelector(".byCODEstatus").dataset.label],
            controls: host.querySelectorAll(".byCODEdocument, .byVIEWtoolbar, button, input, select").length,
            sizes,
            inherited,
            explicit: [getComputedStyle(block).backgroundColor, getComputedStyle(block.querySelector(".byCODEkeyword")).color]
          };
        });
        for (const [index, entry] of result.cases.entries()) {
          const numbered = index >= 2,
            status = index % 2 === 1;
          assert.equal(entry.exact, true);
          assert.equal(entry.framed, numbered || status);
          assert.equal(entry.lines, numbered || status ? 6 : 0);
          assert.deepEqual(entry.numbers, numbered ? Array.from({ length: 6 }, (_, i) => [String(i + 1), "", "true"]) : []);
          assert.equal(entry.status, status ? "javascript · 6 lines" : null);
          assert.equal(entry.comments, "/* firstsecond */");
          assert.equal(entry.strings, "`firstsecond`");
        }
        assert.deepEqual(result.empty, ["", 1, "No source code."]);
        assert.deepEqual(result.plain, ["const value = 1;", 0, "javascript · 1 line"]);
        assert.equal(result.controls, 0);
        assert.deepEqual(result.inherited, ["rgb(18, 52, 86)", "rgb(171, 205, 239)"]);
        assert.deepEqual(result.explicit, ["rgb(0, 0, 0)", "rgb(255, 181, 255)"]);
        for (const size of result.sizes) {
          assert.equal(size.contained, true);
          assert.equal(size.overflow, true);
          assert.equal(size.continuous, true);
          assert.equal(size.digits, "3");
        }
        assert.ok(result.sizes[1].numberWidth > result.sizes[0].numberWidth);
      } finally {
        await isolated.close();
      }
    });
    await t.test("web grammars keep strings/comments separate and retain template context", async () => {
      const result = await page.evaluate(() => {
        const js = byCODEviewer.highlight('const text = "if // return"; /* class */\nconst r = /a[\\/]b/g; const t = `hello ${name + `${2}`}`;', "javascript");
        const html = byCODEviewer.highlight('<style>.x { color: red; }</style><script>const x = "return"; // comment\n</script>', "html");
        const css = byCODEviewer.highlight('@media screen { .x { color: "/* value */"; width: 12px; } }', "css");
        return {
          strings: [...js.querySelectorAll(".byCODEstring")].map((span) => span.textContent),
          comments: [...js.querySelectorAll(".byCODEcomment")].map((span) => span.textContent),
          keywords: [...js.querySelectorAll(".byCODEkeyword")].map((span) => span.textContent),
          regex: js.querySelector(".byCODEregex")?.textContent,
          embeddedJS: html.querySelector(".byCODEkeyword")?.textContent,
          embeddedCSS: html.querySelector(".byCODEproperty")?.textContent,
          cssString: css.querySelector(".byCODEstring")?.textContent,
          cssNumber: css.querySelector(".byCODEnumber")?.textContent,
          cssKeyword: css.querySelector(".byCODEkeyword")?.textContent
        };
      });
      assert.ok(result.strings.includes('"if // return"'));
      assert.deepEqual(result.comments, ["/* class */"]);
      assert.deepEqual(result.keywords, ["const", "const", "const"]);
      assert.equal(result.regex, "/a[\\/]b/g");
      assert.equal(result.embeddedJS, "const");
      assert.equal(result.embeddedCSS, "color");
      assert.equal(result.cssString, '"/* value */"');
      assert.equal(result.cssNumber, "12px");
      assert.equal(result.cssKeyword, "@media");
    });
    await t.test("structured-data grammars handle JSON keys, XML nodes, and YAML block strings", async () => {
      const result = await page.evaluate(() => {
        const json = byCODEviewer.highlight('{"if": "return", "n": 3, "active": true}', "json");
        const xml = byCODEviewer.highlight('<p:r a="x\ny"><![CDATA[<raw>]]><!-- note -->&amp;</p:r>', "xml");
        const yaml = byCODEviewer.highlight("key: &base true\ncopy: *base\nnotes: |\n  if # still a string\nnext: false", "yaml");
        return {
          jsonKey: json.querySelector(".byCODEproperty")?.textContent,
          jsonKeyword: json.querySelector(".byCODEkeyword")?.textContent ?? null,
          xmlString: xml.querySelector(".byCODEstring")?.textContent,
          xmlComment: xml.querySelector(".byCODEcomment")?.textContent,
          yamlString: [...yaml.querySelectorAll(".byCODEstring")].map((e) => e.textContent).join(""),
          yamlVars: [...yaml.querySelectorAll(".byCODEvariable")].map((e) => e.textContent),
          yamlComments: yaml.querySelectorAll(".byCODEcomment").length
        };
      });
      assert.equal(result.jsonKey, '"if"');
      assert.equal(result.jsonKeyword, null);
      assert.equal(result.xmlString, '"x\ny"');
      assert.equal(result.xmlComment, "<!-- note -->");
      assert.match(result.yamlString, /if # still a string/);
      assert.deepEqual(result.yamlVars, ["&base", "*base"]);
      assert.equal(result.yamlComments, 0);
    });
    await t.test("mixed PHP preserves host attributes, embedded CSS/JS, strings, and heredocs", async () => {
      const result = await page.evaluate(() => {
        const source = '<div title="before <?php echo "?>"; ?> after"><style>.x { color: red; }</style><script>const x = "<?php echo $name; ?>";</script><?php $x = <<<TXT\nif ?> not code\nTXT;\necho $x; ?></div>';
        const fragment = byCODEviewer.highlight(source, "php");
        const snippet = byCODEviewer.highlight("echo $value; // note", "php");
        return {
          exact: fragment.textContent === source,
          keywords: [...fragment.querySelectorAll(".byCODEkeyword")].map((e) => e.textContent),
          variables: [...fragment.querySelectorAll(".byCODEvariable")].map((e) => e.textContent),
          strings: [...fragment.querySelectorAll(".byCODEstring")].map((e) => e.textContent),
          snippet: snippet.querySelector(".byCODEkeyword")?.textContent
        };
      });
      assert.equal(result.exact, true);
      assert.ok(result.keywords.includes("const"));
      assert.equal(result.keywords.filter((word) => word === "echo").length, 3);
      assert.ok(result.variables.includes("$name"));
      assert.ok(result.strings.some((text) => text.includes("if ?> not code")));
      assert.ok(result.strings.some((text) => text.includes(" after")));
      assert.equal(result.snippet, "echo");
    });
    await t.test("SQL, Python, Bash, and TypeScript lexical contexts", async () => {
      const result = await page.evaluate(() => {
        const sql = byCODEviewer.highlight("SELECT 'from ''where''' AS [order] /* outer /* inner */ done */; $$ select $$", "sql");
        const py = byCODEviewer.highlight('def f():\n  text = f"return {x}"\n  note = """if\nclass"""\n  print(1)#return', "python");
        const bash = byCODEviewer.highlight("if true; then echo \"$HOME # text\"; fi\ncat <<'EOF'\nif # body\nEOF\n# end", "bash");
        const ts = byCODEviewer.highlight('interface Person { readonly name: string; } const person: Person = { name: "interface" };', "typescript");
        return {
          sqlKeywords: [...sql.querySelectorAll(".byCODEkeyword")].map((e) => e.textContent),
          sqlComments: sql.querySelector(".byCODEcomment")?.textContent,
          pyComments: py.querySelector(".byCODEcomment")?.textContent,
          pyKeywords: [...py.querySelectorAll(".byCODEkeyword")].map((e) => e.textContent),
          bashStrings: [...bash.querySelectorAll(".byCODEstring")].map((e) => e.textContent),
          bashComments: [...bash.querySelectorAll(".byCODEcomment")].map((e) => e.textContent),
          tsKeywords: [...ts.querySelectorAll(".byCODEkeyword")].map((e) => e.textContent)
        };
      });
      assert.deepEqual(result.sqlKeywords, ["SELECT", "AS"]);
      assert.match(result.sqlComments, /inner/);
      assert.equal(result.pyComments, "#return");
      assert.deepEqual(result.pyKeywords, ["def"]);
      assert.ok(result.bashStrings.some((text) => text.includes("if # body")));
      assert.deepEqual(result.bashComments, ["# end"]);
      assert.deepEqual(result.tsKeywords, ["interface", "readonly", "string", "const"]);
    });
    await t.test("language selection, wrapping, line numbers, exact copying, and empty inputs", async () => {
      await page.evaluate(async () => {
        window.codeSource = 'const longName = "' + "text".repeat(100) + '";\r\n';
        await byCODEviewer(root, codeSource, { languageSelect: true, wrapControl: true, language: "js", lineNumbers: false, wordWrap: true }).ready;
      });
      assert.equal(await page.locator(".byCODElineNumber").count(), 0);
      assert.equal(await page.locator(".byCODEline").count(), 2);
      await page.locator(".byVIEWcopy").click();
      assert.equal(await page.evaluate(() => copies.at(-1) === codeSource), true);
      await page.getByRole("combobox", { name: "Code language" }).selectOption("plain");
      await page.waitForFunction(() => document.querySelectorAll(".byCODEtoken").length === 0);
      await page.setViewportSize({ width: 320, height: 640 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.setViewportSize({ width: 1100, height: 800 });
      assert.equal(await page.evaluate(async () => await byCODEviewer(root, "", { languageSelect: true, wrapControl: true, language: "unknown" }).ready), true);
      assert.equal(await page.locator(".byCODEline").count(), 1);
    });
    await t.test("all grammars preserve malformed/untrusted snippets and enforce limits", async () => {
      const result = await page.evaluate(() => {
        const snippets = ['"unterminated', "/* incomplete", '`nested ${ {x: "}"}', '<tag a="x', "a: [broken", '<?php "?>', "<img src=x onerror=window.injected=1>", "<&>\u0000😀\r\n"];
        for (const lang of byCODEviewer.languages) for (const source of snippets) if (byCODEviewer.highlight(source, lang).textContent !== source) return `Lost text: ${lang}`;
        let rejected = 0;
        for (const source of ["a".repeat(2000001), "+".repeat(100001)]) {
          try {
            byCODEviewer.highlight(source, "javascript");
          } catch (error) {
            if (error instanceof RangeError) rejected++;
          }
        }
        const fragment = byCODEviewer.highlight("<script>window.injected=1</script>", "not-supported");
        root.replaceChildren(fragment);
        return { rejected, safe: !root.querySelector("script") && !window.injected, fallback: root.textContent };
      });
      assert.deepEqual(result, { rejected: 2, safe: true, fallback: "<script>window.injected=1</script>" });
    });
    await t.test("large input yields and replacement/disposal cancel obsolete rendering", async () => {
      const result = await page.evaluate(async () => {
        const source = 'const value = "text";\n'.repeat(4000);
        let tick = false;
        setTimeout(() => {
          tick = true;
        }, 0);
        const view = byCODEviewer(root, source, { language: "javascript" });
        const ready = await view.ready;
        const lines = root.querySelectorAll(".byCODEline").length;
        const old = byCODEviewer(root, source),
          current = byCODEviewer(root, "new");
        const cancelled = await old.ready;
        await current.ready;
        old.destroy();
        const preserved = root.textContent.includes("new");
        current.destroy();
        return { tick, ready, lines, cancelled, preserved, disposed: root.childNodes.length === 0 };
      });
      assert.deepEqual(result, { tick: true, ready: true, lines: 4001, cancelled: false, preserved: true, disposed: true });
    });

    await t.test("duplicate loading and source independence", async () => {
      await page.evaluate(() => {
        window.original = byCODEviewer;
      });
      await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
      assert.equal(await page.evaluate(() => original === byCODEviewer), true);
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
    });
  } finally {
    await browser.close();
  }
});

/* --- CONTAINER THEMES --- */
test("container themes are scoped, independent, and compatible with legacy links", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.setContent('<div id="outside" class="dark">Host</div><div id="first" data-theme="dark"></div><div id="second" class="light"></div><div id="third"></div>');
    await page.addStyleTag({ path: path.join(__dirname, "../code.css") });
    await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
    await page.evaluate(
      async (args) => {
        window.renderTheme = async (element) => {
          const controller = window.byCODEviewer(element, ...args);
          if (controller?.ready) await controller.ready;
        };
        for (const id of ["first", "second", "third"]) await renderTheme(document.getElementById(id));
      },
      ['const theme = "local";']
    );
    const color = (id) => page.locator("#" + id).evaluate((element) => getComputedStyle(element).backgroundColor);
    assert.equal(await color("first"), "rgb(39, 40, 34)");
    assert.equal(await color("second"), "rgb(250, 250, 245)");
    assert.equal(await page.locator("#outside").evaluate((element) => getComputedStyle(element).getPropertyValue("--by-view-muted")), "");
    assert.equal(await page.locator("#first .byVIEWtoolbar").evaluate((element) => getComputedStyle(element).getPropertyValue("--by-view-muted").trim()), "#75715e");
    await page.locator("#first .byVIEWthemeToggle").click();
    assert.equal(await page.locator("#first").getAttribute("data-theme"), "light");
    assert.equal(await color("second"), "rgb(250, 250, 245)");
    await page.locator("#second .byVIEWthemeToggle").click();
    assert.equal(
      await page
        .locator("#second")
        .getAttribute("class")
        .then((classes) => classes.split(/\s+/).includes("dark")),
      true
    );
    assert.equal(await page.locator("#second").getAttribute("data-theme"), null);
    assert.equal(await color("second"), "rgb(39, 40, 34)");
    await page.evaluate(async () => {
      const second = document.getElementById("second");
      second.dataset.theme = "light";
      await renderTheme(second);
    });
    assert.equal(await color("second"), "rgb(250, 250, 245)");
    await page.evaluate(() => {
      const first = document.getElementById("first");
      first.style.setProperty("--by-view-bg", "#123456");
    });
    assert.equal(await color("first"), "rgb(18, 52, 86)");
    assert.equal(await color("second"), "rgb(250, 250, 245)");
    await page.evaluate(() => document.getElementById("first").style.removeProperty("--by-view-bg"));
    assert.equal(requests.length, 0, "Container theme changes must not fetch stylesheets");

    await page.route("https://legacy.test/**", (route) => route.fulfill({ body: legacyThemeCSS(route.request().url().includes(".dark.css") ? "dark" : "light"), contentType: "text/css" }));
    await page.evaluate(async () => {
      const second = document.getElementById("second");
      second.removeAttribute("data-theme");
      second.classList.remove("light", "dark");
      await new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.id = "byVIEWtheme";
        link.rel = "stylesheet";
        link.href = "https://legacy.test/code.light.css?cache=1#theme";
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
      });
      await renderTheme(second);
      await renderTheme(document.getElementById("third"));
    });
    await page.locator("#second .byVIEWthemeToggle").click();
    await page.waitForFunction(() => getComputedStyle(document.getElementById("second")).backgroundColor === "rgb(39, 40, 34)");
    assert.equal(await color("third"), "rgb(39, 40, 34)");
    assert.equal(await color("first"), "rgb(250, 250, 245)");
    assert.equal(await page.locator("#first .byVIEWthemeToggle").getAttribute("aria-label"), "Switch to dark theme");
    assert.equal(await page.locator("#byVIEWtheme").getAttribute("href"), "https://legacy.test/code.dark.css?cache=1#theme");
    await page.evaluate(async () => {
      document.getElementById("byVIEWtheme").remove();
      await renderTheme(document.getElementById("second"));
    });
    await page.locator("#second .byVIEWthemeToggle").click();
    assert.equal(await page.locator("#second").getAttribute("data-theme"), "dark");
    assert.equal(await color("third"), "rgb(250, 250, 245)");
  } finally {
    await browser.close();
  }
});

/* --- PALETTES AND CONTRAST --- */
test("named palettes retain mode, isolate custom CSS, and meet High Contrast targets", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="outside">Host</div><div id="viewer"></div><div id="other" data-theme="dark"></div>');
    await page.addStyleTag({ path: path.join(__dirname, "../code.css") });
    await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
    await page.evaluate(
      async (args) => {
        window.renderPalette = async (id) => {
          const controller = window.byCODEviewer(document.getElementById(id), ...args);
          if (controller?.ready) await controller.ready;
        };
        await renderPalette("viewer");
        await renderPalette("other");
      },
      ['const theme = "named"; // comment', { language: "javascript" }]
    );
    const root = page.locator("#viewer");
    const background = () => root.evaluate((element) => getComputedStyle(element).backgroundColor);
    assert.equal(await background(), "rgb(250, 250, 245)", "Default remains Monokai Light");
    for (const [palette, colors] of Object.entries({
      monokai: ["rgb(250, 250, 245)", "rgb(39, 40, 34)"],
      github: ["rgb(255, 255, 255)", "rgb(13, 17, 23)"],
      solarized: ["rgb(253, 246, 227)", "rgb(0, 43, 54)"],
      "high-contrast": ["rgb(255, 255, 255)", "rgb(0, 0, 0)"]
    })) {
      await root.evaluate((element, palette) => {
        element.dataset.theme = palette;
        element.classList.remove("light", "dark");
      }, palette);
      assert.equal(await background(), colors[0], palette);
      await root.locator(".byVIEWthemeToggle").click();
      assert.equal(await root.getAttribute("data-theme"), palette);
      assert.equal(await background(), colors[1], palette);
      await page.evaluate(() => renderPalette("viewer"));
      assert.equal(await background(), colors[1], "Rendering preserves the palette and mode");
      await root.locator(".byVIEWthemeToggle").click();
      assert.equal(await background(), colors[0]);
    }
    for (const mode of ["light", "dark"]) {
      await root.evaluate((element, mode) => {
        element.classList.toggle("dark", mode === "dark");
        element.classList.toggle("light", mode === "light");
      }, mode);
      await root.locator(".byVIEWcopy").focus();
      const measurements = await root.evaluate((element) => {
        const style = getComputedStyle(element);
        const luminance = (color) => {
          const channels = color.startsWith("#")
            ? color
                .slice(1)
                .match(/../g)
                .map((part) => parseInt(part, 16))
            : color
                .match(/[\d.]+/g)
                .slice(0, 3)
                .map(Number);
          const values = channels.map((channel) => channel / 255).map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
        };
        const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
        const variables = [...style].filter((property) => property.startsWith("--by-")).map((property) => [property, style.getPropertyValue(property).trim()]);
        const backgrounds = [style.backgroundColor, ...variables.filter(([property]) => /-(?:alt|code-bg|add|remove)$/.test(property)).map(([, value]) => value)];
        const text = variables.filter(([property, value]) => /^#[0-9a-f]{6}$/i.test(value) && !/-(?:bg|border|alt|add|remove)$/.test(property));
        const button = getComputedStyle(element.querySelector(".byVIEWcopy"));
        return {
          text: text.flatMap(([property, value]) => backgrounds.map((bg) => ({ property, ratio: contrast(value, bg) }))),
          border: contrast(button.borderTopColor, style.backgroundColor),
          focus: contrast(button.outlineColor, style.backgroundColor),
          outline: parseFloat(button.outlineWidth)
        };
      });
      assert.ok(measurements.text.length >= 5);
      for (const { property, ratio } of measurements.text) assert.ok(ratio >= 7, mode + " " + property + ": " + ratio.toFixed(2));
      assert.ok(measurements.border >= 3);
      assert.ok(measurements.focus >= 3 && measurements.outline >= 2);
    }
    await root.evaluate((element) => {
      element.classList.add("light", "dark");
      element.dataset.theme = "github";
    });
    assert.equal(await background(), "rgb(13, 17, 23)", "Dark wins when both classes exist");
    await root.evaluate((element) => {
      element.dataset.theme = "light";
    });
    assert.equal(await background(), "rgb(250, 250, 245)", "Legacy mode aliases override classes");
    await page.addStyleTag({ content: '.byCODEdocument.light[data-theme="ocean"] { --by-view-bg: #f3f8fc; } .byCODEdocument.dark[data-theme="ocean"] { --by-view-bg: #102a43; }' });
    await root.evaluate((element) => {
      element.dataset.theme = "ocean";
      element.classList.remove("light", "dark");
    });
    await page.route("https://legacy.test/**", (route) => route.fulfill({ body: "", contentType: "text/css" }));
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const link = document.createElement("link");
          link.id = "byVIEWtheme";
          link.rel = "stylesheet";
          link.href = "https://legacy.test/code.dark.css?cache=1#theme";
          link.onload = resolve;
          document.head.appendChild(link);
        })
    );
    await page.evaluate(() => renderPalette("viewer"));
    assert.equal(await background(), "rgb(250, 250, 245)", "An unclassified custom palette starts in Light");
    await root.locator(".byVIEWthemeToggle").click();
    assert.equal(await background(), "rgb(16, 42, 67)");
    assert.equal(await root.getAttribute("data-theme"), "ocean");
    assert.equal(await page.locator("#byVIEWtheme").getAttribute("href"), "https://legacy.test/code.dark.css?cache=1#theme");
    assert.equal(await page.locator("#other").evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(39, 40, 34)");
    assert.equal(await page.locator("#outside").evaluate((element) => getComputedStyle(element).getPropertyValue("--by-view-muted")), "");
    const fragmentColors = await page.evaluate(() => {
      const parent = document.getElementById("other");
      parent.dataset.theme = "github";
      parent.classList.add("dark");
      const inherited = byCODEviewer.highlight("const a = 1;", "javascript");
      const explicit = byCODEviewer.highlight("const b = 2;", "javascript");
      explicit.firstElementChild.dataset.theme = "high-contrast";
      explicit.firstElementChild.classList.add("light");
      parent.append(inherited, explicit);
      return [...parent.querySelectorAll(".byCODEhighlight .byCODEkeyword")].map((token) => getComputedStyle(token).color);
    });
    assert.deepEqual(fragmentColors, ["rgb(255, 123, 114)", "rgb(122, 0, 59)"]);
  } finally {
    await browser.close();
  }
});

/* --- CONTROLS AND CLIPBOARD FEEDBACK --- */
test("viewer defaults, optional tools, and copy feedback", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 720 }, reducedMotion: "reduce" });
    await page.setContent('<div id="viewer"></div>');
    await page.addStyleTag({ path: path.join(__dirname, "../code.css") });
    await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
    await page.evaluate(
      (args) => {
        window.renderUI = async (options = {}) => {
          const result = byCODEviewer(document.getElementById("viewer"), ...args, options);
          await result?.ready;
        };
      },
      ["const needle = 1;\nconsole.log(needle);"]
    );
    await page.evaluate(() => renderUI());
    assert.equal(await page.locator(".byVIEWcontrols button").count(), 5);
    assert.equal(await page.locator(".byVIEWfontSizes").count(), 1);
    assert.equal(await page.locator(".byVIEWactions :is(input, select, button):visible").count(), 0);
    assert.equal(await page.locator(".byVIEWstatus:visible").count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => renderUI({ fontSizeControls: false, statusBar: false, wordWrap: false }));
    assert.equal(await page.locator(".byVIEWfontSizes").count(), 0);
    assert.equal(await page.locator(".byVIEWstatus:visible").count(), 0);
    assert.equal(await page.locator(".byCODEwrap").count(), 0);
    await page.evaluate(() => renderUI());
    assert.equal(await page.locator(".byCODEwrap").count(), 1);
    for (const scale of [1, 1.5]) {
      for (const controlsSize of ["small", "regular", "large"]) {
        for (const font of ["ui-monospace, monospace", "Georgia, serif"]) {
          for (const mode of ["light", "dark"]) {
            const errors = await page.evaluate(
              async ({ scale, controlsSize, font, mode }) => {
                document.documentElement.style.fontSize = `${scale}rem`;
                const host = document.getElementById("viewer");
                host.dataset.theme = mode;
                host.style.setProperty("--by-view-controls-font", font);
                await renderUI({ controlsSize });
                const button = host.querySelector(".byVIEWthemeToggle");
                const rect = button.getBoundingClientRect();
                const style = getComputedStyle(button),
                  thumb = getComputedStyle(button, "::after");
                const innerWidth = rect.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
                const innerHeight = rect.height - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth);
                const position = (value, extent) => (value.endsWith("%") ? (parseFloat(value) * extent) / 100 : parseFloat(value));
                const transform = new DOMMatrixReadOnly(thumb.transform);
                const centerX = rect.left + parseFloat(style.borderLeftWidth) + position(thumb.left, innerWidth) + transform.m41 + parseFloat(thumb.width) / 2;
                const centerY = rect.top + parseFloat(style.borderTopWidth) + position(thumb.top, innerHeight) + transform.m42 + parseFloat(thumb.height) / 2;
                const icons = [...button.querySelectorAll("svg")];
                const icon = icons[mode === "dark" ? 1 : 0].getBoundingClientRect();
                return [Math.abs(centerX - icon.x - icon.width / 2), Math.abs(centerY - icon.y - icon.height / 2), Math.abs(centerY - rect.y - rect.height / 2)];
              },
              { scale, controlsSize, font, mode }
            );
            assert.ok(
              errors.every((error) => error < 0.06),
              `${scale} ${controlsSize} ${font} ${mode}: ${errors}`
            );
          }
        }
      }
    }
    await page.evaluate(async () => {
      document.documentElement.style.fontSize = "";
      document.getElementById("viewer").style.removeProperty("--by-view-controls-font");
      await renderUI();
    });
    for (const mode of ["light", "dark"]) {
      await page.locator("#viewer").evaluate((element, mode) => {
        element.dataset.theme = mode;
      }, mode);
      await page.evaluate(() => renderUI({ toolbar: false, controlsPosition: "bottom", sorting: false, pagination: false, collapsible: false, details: false, lineNumbers: false, loadMore: false }));
      assert.equal(await page.locator("#viewer :is(button, input, select, summary):visible").count(), 0);
      assert.equal(await page.locator(".byVIEWtoolbar").count(), 0);
      assert.equal(await page.locator("#viewer").evaluate((element) => element.classList.contains("byVIEWbottom")), false);
      assert.match(await page.locator("#viewer").textContent(), /needle/);
    }
    await page.evaluate(() => renderUI({ wordWrap: true, wrapControl: false, language: "javascript" }));
    assert.equal(await page.locator(".byCODEwrap").count(), 1);
    assert.equal(await page.getByRole("checkbox", { name: "Word wrap" }).count(), 0);
    assert.ok((await page.locator(".byCODEkeyword").count()) > 0);
    await page.evaluate(() => renderUI({ credits: false }));
    assert.equal(await page.locator(".byVIEWinfo").count(), 0);
    assert.equal(await page.locator(".byVIEWcontrols button").count(), 5);
    await page.evaluate(() => renderUI({ credits: false, themeToggle: false, fontSizeControls: false, copyButton: false }));
    assert.equal(await page.locator(".byVIEWtoolbar").count(), 0);
    await page.evaluate((options) => renderUI({ fontSizeControls: true, ...options }), { languageSelect: true, wrapControl: true, statusBar: true });
    assert.equal(await page.locator(".byVIEWfontSize").count(), 3);
    assert.equal(await page.locator(".byVIEWpanel > .byVIEWstatus:visible").count(), 1);
    assert.ok(await page.locator(".byVIEWpanel > .byVIEWstatus").evaluate((status) => parseFloat(getComputedStyle(status).borderBottomWidth) > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Denied");
          }
        }
      });
    });
    await page.locator(".byVIEWcopy").click();
    await page.mouse.move(0, 0);
    await page.locator(".byVIEWcopy").evaluate((element) => element.blur());
    assert.equal(await page.locator(".byVIEWcopy").getAttribute("data-state"), "error");
    assert.equal(await page.locator(".byVIEWcopy").textContent(), "Failed");
    await page.evaluate(() => {
      navigator.clipboard.writeText = async (value) => {
        window.copiedSource = value;
      };
    });
    await page.locator(".byVIEWcopy").click();
    assert.equal(await page.locator(".byVIEWcopy").getAttribute("data-state"), "success");
    assert.match(await page.evaluate(() => copiedSource), /needle/);
  } finally {
    await browser.close();
  }
});

/* --- HIGHLIGHT FRAGMENTS --- */
test("highlight fragments inherit arbitrary hosts and retain standalone and explicit themes", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<section id="host"><pre><code id="inherited"></code><code id="explicit"></code><code id="light"></code><code id="monokai"></code></pre></section><pre id="standalone"></pre><aside id="partial"></aside><div id="outside">Host text</div>'
    );
    await page.addStyleTag({ path: path.join(__dirname, "../code.css") });
    await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
    const tokens = await page.evaluate(() => {
      const source = "/* first\r\nsecond */\r\nconst value = `Hello ${name}`;";
      const iterator = byCODEviewer.tokenize(source, "js");
      const first = iterator.next(),
        rest = [...iterator];
      let invalid = false;
      try {
        [...byCODEviewer.tokenize(null)];
      } catch (error) {
        invalid = error instanceof TypeError;
      }
      return { source, restored: [first.value, ...rest].map((token) => token.text).join(""), first: first.value.type, invalid };
    });
    assert.equal(tokens.restored, tokens.source);
    assert.equal(tokens.first, "comment");
    assert.equal(tokens.invalid, true);
    await page.evaluate(() => {
      const names = ["comment", "keyword", "string", "number", "property", "tag"];
      const colors = ["#102030", "#203040", "#304050", "#405060", "#506070", "#607080"];
      names.forEach((name, index) => document.getElementById("host").style.setProperty("--by-code-" + name, colors[index]));
      document.getElementById("partial").style.setProperty("--by-code-keyword", "#123456");
      for (const id of ["inherited", "explicit", "light", "monokai", "standalone", "partial"]) {
        const fragment = byCODEviewer.highlight('<div class="note"><script>const n = 42; // note\n</script></div>', "html");
        if (id === "explicit") {
          fragment.firstElementChild.dataset.theme = "github";
          fragment.firstElementChild.classList.add("dark");
        }
        if (id === "light") fragment.firstElementChild.classList.add("light");
        if (id === "monokai") fragment.firstElementChild.dataset.theme = "monokai";
        document.getElementById(id).append(fragment);
      }
      window.fragmentColors = (id) => names.map((name) => getComputedStyle(document.querySelector("#" + id + " .byCODE" + (name === "property" ? "attribute" : name))).color);
    });
    const light = ["rgb(116, 116, 97)", "rgb(183, 25, 86)", "rgb(100, 125, 0)", "rgb(124, 66, 181)", "rgb(153, 97, 24)", "rgb(183, 25, 86)"];
    assert.deepEqual(await page.evaluate(() => fragmentColors("standalone")), light);
    assert.deepEqual(await page.evaluate(() => fragmentColors("inherited")), ["rgb(16, 32, 48)", "rgb(32, 48, 64)", "rgb(48, 64, 80)", "rgb(64, 80, 96)", "rgb(80, 96, 112)", "rgb(96, 112, 128)"]);
    assert.deepEqual(
      await page.evaluate(() => fragmentColors("partial")),
      light.map((color, index) => (index === 1 ? "rgb(18, 52, 86)" : color))
    );
    assert.deepEqual(await page.evaluate(() => fragmentColors("explicit")), ["rgb(145, 152, 161)", "rgb(255, 123, 114)", "rgb(165, 214, 255)", "rgb(121, 192, 255)", "rgb(255, 166, 87)", "rgb(126, 231, 135)"]);
    assert.deepEqual(await page.evaluate(() => fragmentColors("light")), light);
    assert.deepEqual(await page.evaluate(() => fragmentColors("monokai")), light);
    await page.locator("#host").evaluate((host) => host.style.setProperty("--by-code-keyword", "#abcdef"));
    assert.equal(await page.evaluate(() => fragmentColors("inherited")[1]), "rgb(171, 205, 239)");
    assert.equal(await page.evaluate(() => fragmentColors("explicit")[1]), "rgb(255, 123, 114)");
    await page.locator("#inherited .byCODEhighlight").evaluate((fragment) => fragment.style.setProperty("--by-code-string", "#fedcba"));
    assert.equal(await page.evaluate(() => fragmentColors("inherited")[2]), "rgb(254, 220, 186)");
    await page.locator("#inherited .byCODEhighlight").evaluate((fragment) => document.getElementById("partial").replaceChildren(fragment));
    assert.equal(await page.evaluate(() => fragmentColors("partial")[1]), "rgb(18, 52, 86)");
    assert.equal(await page.locator("#outside").evaluate((element) => getComputedStyle(element).getPropertyValue("--by-code-keyword")), "");
  } finally {
    await browser.close();
  }
});

/* --- DOCUMENT AND CONTENT SURFACES --- */
test("document and content backgrounds stay independent through theme and toolbar changes", async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, channel: process.env.BROWSER_CHANNEL || "chrome" });
  try {
    const page = await browser.newPage();
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());
    await page.setContent('<div id="viewer" data-theme="light"></div><div id="neighbor" data-theme="light"></div>');
    await page.addStyleTag({ path: path.join(__dirname, "../code.css") });
    await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
    await page.evaluate(async () => {
      for (const id of ["viewer", "neighbor"]) {
        const result = byCODEviewer(document.getElementById(id), "const answer = 42;");
        await result?.ready;
      }
    });
    const root = page.locator("#viewer");
    const neighbor = await page.locator("#neighbor").evaluate((element) => getComputedStyle(element).backgroundColor);
    await root.evaluate((element) => {
      element.style.setProperty("--by-view-document-bg", "transparent");
      element.style.setProperty("--by-view-container-bg", "#123456");
    });
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#viewer .byVIEWcopy")).backgroundColor === "rgb(18, 52, 86)");
    for (const changeMode of [false, true]) {
      if (changeMode) await root.locator(".byVIEWthemeToggle").click();
      assert.equal(await root.evaluate((element) => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)");
      assert.equal(await root.locator(".byVIEWpanel").evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(18, 52, 86)");
      assert.equal(
        await root
          .locator(".byVIEWcopy")
          .first()
          .evaluate((element) => getComputedStyle(element).backgroundColor),
        "rgb(18, 52, 86)"
      );
      assert.equal(await root.locator(".byVIEWtoolbar").evaluate((element) => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)");
    }
    assert.equal(await page.locator("#neighbor").evaluate((element) => getComputedStyle(element).backgroundColor), neighbor);
    await root.evaluate((element) => element.style.removeProperty("--by-view-container-bg"));
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#viewer .byVIEWcopy")).backgroundColor === "rgb(39, 40, 34)");
    assert.notEqual(
      await root
        .locator(".byVIEWcopy")
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgba(0, 0, 0, 0)"
    );
  } finally {
    await browser.close();
  }
});

/* --- INTERACTION MOTION --- */
test("animation options preserve initial visibility and override system motion preferences", async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome", executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
  try {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    await page.route("https://cdn.jsdelivr.net/**", (route) => (route.request().url().endsWith("fontawesome.min.css") ? route.fulfill({ body: "", contentType: "text/css" }) : route.abort()));
    await page.setContent('<div id="motion-viewer" data-theme="light"></div>');
    await page.addStyleTag({ path: path.join(__dirname, "../code.css") });
    await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
    await page.evaluate(() => {
      window.renderMotion = async (animations) => {
        window.motionController = byCODEviewer(document.getElementById("motion-viewer"), "const answer = 42;", { animations });
        await motionController?.ready;
      };
    });
    await page.evaluate(() => renderMotion());
    const root = page.locator("#motion-viewer");
    assert.equal(await root.evaluate((element) => element.classList.contains("byVIEWmotion")), true);
    assert.equal(await root.evaluate((element) => getComputedStyle(element).opacity), "1");
    assert.equal(await root.evaluate((element) => element.getAnimations({ subtree: true }).length), 0, "Initial content does not animate");
    assert.equal(
      await root
        .locator("button")
        .first()
        .evaluate((element) => getComputedStyle(element).transitionDuration.split(",")[0]),
      "0.18s"
    );
    const disclosure = await root.evaluateHandle((element) => {
      const details = document.createElement("details");
      details.id = "motion-disclosure";
      details.innerHTML = "<summary>Details</summary><p>Already available content</p>";
      element.append(details);
      getComputedStyle(details, "::details-content").blockSize;
      return details;
    });
    await disclosure.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => getComputedStyle(document.getElementById("motion-disclosure"), "::details-content").opacity === "0");
    const opening = await disclosure.evaluate(async (details) => {
      details.open = true;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return Number(getComputedStyle(details, "::details-content").opacity);
    });
    assert.ok(opening > 0 && opening < 1, "A deliberate disclosure eases in even with reduced motion requested");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("motion-disclosure"), "::details-content").opacity === "1");
    await disclosure.evaluate((details) => {
      details.open = false;
    });
    await page.waitForFunction(() => getComputedStyle(document.getElementById("motion-disclosure"), "::details-content").opacity === "0");
    assert.equal(await disclosure.evaluate((details) => details.open), false);
    await page.evaluate(() => renderMotion(false));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    assert.equal(await root.evaluate((element) => element.classList.contains("byVIEWmotion")), false);
    assert.equal(
      await root
        .locator("button")
        .first()
        .evaluate((element) => getComputedStyle(element).transitionDuration),
      "0s"
    );
    assert.equal(await root.evaluate((element) => element.getAnimations({ subtree: true }).length), 0);
  } finally {
    await browser.close();
  }
});
