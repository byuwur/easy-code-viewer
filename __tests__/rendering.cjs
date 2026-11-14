/*
 * File: __tests__/rendering.cjs
 * Desc: CODE library contracts using local renderer assets; playground checks live in playground.cjs.
 */

// --- DEPENDENCIES ---
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { chromium, firefox, webkit } = require("playwright");
const browserEngine = process.env.BROWSER_ENGINE || "chromium";
assert.ok(["chromium", "firefox", "webkit"].includes(browserEngine), "Unsupported BROWSER_ENGINE");
const browserType = { chromium, firefox, webkit }[browserEngine];
// Browser channels and executable overrides apply only to Chromium.
const launchBrowser = () =>
  browserType.launch(
    browserEngine === "chromium"
      ? {
          channel: process.env.BROWSER_CHANNEL || undefined,
          executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined
        }
      : {}
  );

// --- THEME FIXTURES ---
// Caller-provided legacy stylesheets reuse the canonical palettes without distribution files.
const legacyThemeCSS = (theme) => {
  const css = require("node:fs").readFileSync(path.join(__dirname, "../code.css"), "utf8");
  const section = css.split(`/* --- ${theme.toUpperCase()} --- */`)[1];
  return `.byCODEdocument {${section.match(/\{([\s\S]*?)\}/)[1]}}`;
};

// --- STANDALONE RENDERER ---
test("CODE standalone browser contracts", async (t) => {
  const browser = await launchBrowser();
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
          body: '<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="code.css"><script src="code.js"></script><div id="viewer" data-theme="light"></div>'
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
    await t.test("every supported language has an exact-source playground demonstration", async () => {
      const html = require("node:fs").readFileSync(path.join(__dirname, "../index.html"), "utf8");
      const samples = require("node:vm").runInNewContext(`(${html.match(/const samples = (\{[\s\S]*?^        \});/m)[1]})`);
      const result = await page.evaluate((samples) => {
        const languages = byCODEviewer.languages;
        const failures = [];
        for (const language of languages) {
          const sample = samples[language];
          if (!sample) {
            failures.push(`${language}: missing demo`);
            continue;
          }
          const tokens = [...byCODEviewer.tokenize(sample.source, language)];
          if (tokens.map((token) => token.text).join("") !== sample.source) failures.push(`${language}: changed source`);
          if (language !== "plain" && !tokens.some((token) => token.type !== "plain")) failures.push(`${language}: uncolored demo`);
          if (byCODEviewer.highlight(sample.source, language).textContent !== sample.source) failures.push(`${language}: changed fragment`);
        }
        return { failures, frozen: Object.isFrozen(languages), languages };
      }, samples);
      assert.deepEqual(result.failures, []);
      assert.equal(result.frozen, true);
      assert.equal(result.languages.length, 80);
      const hiddenOptions = await page.evaluate(async () => {
        const createElement = document.createElement;
        let options = 0;
        document.createElement = function (name, ...args) {
          if (name === "option") options++;
          return createElement.call(this, name, ...args);
        };
        try {
          await byCODEviewer(root, "fn main() {}", { language: "rust", languageSelect: false }).ready;
          return options;
        } finally {
          document.createElement = createElement;
        }
      });
      assert.equal(hiddenOptions, 0, "A hidden language picker must not allocate all language options");

      assert.equal(
        await page.evaluate(() =>
          ["constructor", "__proto__", "not-a-language"].every((language) => {
            const source = "const value = 42;";
            return JSON.stringify([...byCODEviewer.tokenize(source, language)]) === JSON.stringify([{ type: "plain", text: source }]);
          })
        ),
        true
      );

      const aliases = {
        " C++ ": "cpp",
        cs: "csharp",
        rs: "rust",
        kt: "kotlin",
        golang: "go",
        rb: "ruby",
        ps1: "powershell",
        bat: "batch",
        hs: "haskell",
        ex: "elixir",
        "f#": "fsharp",
        clj: "clojure",
        ml: "ocaml",
        pas: "pascal",
        f90: "fortran",
        vb: "vbnet",
        gql: "graphql",
        proto: "protobuf",
        tf: "hcl",
        md: "markdown",
        asm: "assembly",
        gd: "gdscript"
      };
      assert.equal(
        await page.evaluate(
          ({ aliases, samples }) =>
            Object.entries(aliases).every(([alias, language]) => JSON.stringify([...byCODEviewer.tokenize(samples[language].source, alias)]) === JSON.stringify([...byCODEviewer.tokenize(samples[language].source, language)])),
          { aliases, samples }
        ),
        true
      );
    });
    await t.test("raw strings, nested comments, hardware numbers and JSX keep lexical boundaries", async () => {
      const cases = [
        ["rust", 'r###"a"# /* text */"###', "string"],
        ["cpp", 'R"note(a) // text " quoted)note"', "string"],
        ["csharp", '@"C:\\folder\\file ""quoted"""', "string"],
        ["csharp", '""""three quotes """ // text\nend""""', "string"],
        ["swift", '##"a"# // text"##', "string"],
        ["lua", "[=[a]] -- text]=]", "string"],
        ["lua", "--[==[a]] -- text]==]", "comment"],
        ["rust", "/* outer /* inner */ tail */", "comment"],
        ["d", "/+ outer /+ inner +/ tail +/", "comment"],
        ["kotlin", "/* outer /* inner */ tail */", "comment"],
        ["haskell", "{- outer {- inner -} tail -}", "comment"],
        ["ocaml", "(* outer (* inner *) tail *)", "comment"],
        ["julia", "#= outer #= inner =# tail =#", "comment"],
        ["nim", "#[ outer #[ inner ]# tail ]#", "comment"],
        ["powershell", "<# outer # text #>", "comment"],
        ["powershell", "@'\n# text\n'@", "string"],
        ["systemverilog", "8'hFF", "number"],
        ["verilog", "1'b1", "number"]
      ];
      const result = await page.evaluate((cases) => cases.map(([language, source]) => [...byCODEviewer.tokenize(source, language)]), cases);
      cases.forEach(([language, source, type], i) => assert.deepEqual(result[i], [{ type, text: source }], language));
      const boundaries = await page.evaluate(() => ({
        d: [...byCODEviewer.tokenize("/* outer /* inner */ auto value = 1;", "d")],
        functional: ["haskell", "ocaml", "fsharp"].map((language) => [...byCODEviewer.tokenize("let value' = 42", language)].filter((part) => part.type === "string").length),
        fsharp: [...byCODEviewer.tokenize("/* ordinary operators */", "fsharp")].filter((part) => part.type === "comment").length
      }));
      assert.equal(boundaries.d[0].text, "/* outer /* inner */");
      assert.ok(boundaries.d.some((part) => part.type === "keyword" && part.text === "auto"));
      assert.deepEqual(boundaries.functional, [0, 0, 0]);
      assert.equal(boundaries.fsharp, 0);
      const jsx = await page.evaluate(() => {
        const source = 'const item = <Box label="if">Text {ready && <b>{count + 1}</b>}</Box>;';
        const parts = [...byCODEviewer.tokenize(source, "jsx")];
        const generics = [...byCODEviewer.tokenize("const identity = <T,>(value: T) => value;", "tsx")];
        return {
          exact: parts.map((part) => part.text).join("") === source,
          tags: parts.filter((part) => part.type === "tag").map((part) => part.text),
          keywords: parts.filter((part) => part.type === "keyword").map((part) => part.text),
          genericTags: generics.filter((part) => part.type === "tag").length
        };
      });
      assert.equal(jsx.exact, true);
      assert.ok(jsx.tags.includes("<Box") && jsx.tags.includes("</Box") && jsx.tags.includes("<b"));
      assert.deepEqual(jsx.keywords, ["const"]);
      assert.equal(jsx.genericTags, 0);
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

// --- CONTAINER THEMES ---
test("container themes are scoped, independent, and compatible with legacy links", async () => {
  const browser = await launchBrowser();
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
          const controller = window.byCODEviewer(element, ...args.slice(0, 1), { ...args[1], animations: false });
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

// --- PALETTES AND CONTRAST ---
test("named palettes retain mode, isolate custom CSS, and meet High Contrast targets", async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const warnings = [];
    page.on("console", (message) => {
      if (message.type() === "warning" && message.text().includes("code.themes.css")) warnings.push(message.text());
    });
    await page.setContent('<div id="outside">Host</div><div id="viewer"></div><div id="other" data-theme="dark"></div>');
    await page.addStyleTag({ path: path.join(__dirname, "../code.css") });
    await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
    await page.evaluate(
      async (args) => {
        window.renderPalette = async (id) => {
          const controller = window.byCODEviewer(document.getElementById(id), ...args.slice(0, 1), { ...args[1], animations: false });
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
    assert.equal(warnings.length, 0, "Core palettes need no optional pack");
    await root.evaluate((element) => {
      element.dataset.theme = "dracula";
    });
    await page.evaluate(() => renderPalette("viewer"));
    assert.match(warnings[0], /code\.themes\.css/);
    await page.evaluate(() => renderPalette("viewer"));
    assert.equal(warnings.length, 1, "Repeated renders do not repeat a missing-pack warning");
    await root.evaluate((element) => {
      element.dataset.theme = "custom-user";
    });
    await page.evaluate(() => renderPalette("viewer"));
    assert.equal(warnings.length, 1, "Custom CSS names are supported without a pack");
    await page.addStyleTag({ path: path.join(__dirname, "../code.themes.css") });
    await root.evaluate((element) => {
      element.dataset.theme = "bubblegum";
    });
    await page.evaluate(() => renderPalette("viewer"));
    assert.equal(warnings.length, 1, "Loaded packs do not warn for other presets");
    const paletteSelect = require("node:fs")
      .readFileSync(path.join(__dirname, "../index.html"), "utf8")
      .match(/<select id="preview-palette"[\s\S]*?<\/select>/)[0];
    const paletteNames = [...paletteSelect.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]).filter((name) => name !== "custom");
    assert.equal(paletteNames.length, 48);
    assert.equal(new Set(paletteNames).size, 48);
    const readme = require("node:fs").readFileSync(path.join(__dirname, "../README.md"), "utf8");
    for (const name of paletteNames) assert.match(readme, new RegExp("\\|\\s*`" + name + "`\\s*\\|"), `${name} must be documented`);
    const failures = await root.evaluate((element, names) => {
      const luminance = (value) => {
        const channels = value.startsWith("#")
          ? value
              .slice(1)
              .match(/../g)
              .map((part) => parseInt(part, 16))
          : value
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number);
        const linear = channels.map((channel) => channel / 255).map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
      };
      const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
      const failures = [];
      for (const name of names.filter((name) => !["monokai", "github", "solarized", "high-contrast"].includes(name))) {
        element.dataset.theme = name;
        for (const mode of ["light", "dark"]) {
          element.classList.toggle("dark", mode === "dark");
          element.classList.toggle("light", mode === "light");
          const style = getComputedStyle(element);
          const variables = [...style].map((name) => [name, style.getPropertyValue(name).trim()]).filter(([, value]) => /^#[\da-f]{6}$/i.test(value));
          const backgrounds = [style.backgroundColor, ...variables.filter(([name]) => /-(?:alt|code-bg|add|remove)$/.test(name)).map(([, value]) => value)];
          const textColors = [["text", style.color], ...variables.filter(([name]) => /-(?:text|secondary|accent|string|literal|error|warn|info|debug|comment|keyword|number|property|tag|link|quote|toggle|placeholder|muted)$/.test(name))];
          for (const [property, value] of textColors) {
            if (backgrounds.some((background) => contrast(value, background) < 4.5)) failures.push(`${name} ${mode} ${property}`);
          }
          const border = variables.find(([name]) => /^--by-(?:view|json|md)-border$/.test(name))?.[1];
          if (border && contrast(border, style.backgroundColor) < 3) failures.push(`${name} ${mode} border`);
        }
      }
      element.dataset.theme = "high-contrast";
      return failures;
    }, paletteNames);
    assert.deepEqual(failures, [], "New palettes must keep text and control boundaries readable in both modes");
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
    await page.addStyleTag({ content: '.byCODEdocument.light[data-theme="custom-ocean"] { --by-view-bg: #f3f8fc; } .byCODEdocument.dark[data-theme="custom-ocean"] { --by-view-bg: #102a43; }' });
    await root.evaluate((element) => {
      element.dataset.theme = "custom-ocean";
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
    assert.equal(await root.getAttribute("data-theme"), "custom-ocean");
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

// --- CONTROLS AND CLIPBOARD FEEDBACK ---
test("viewer defaults, optional tools, and copy feedback", async () => {
  const browser = await launchBrowser();
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
    for (const controlsPosition of ["top", "bottom"]) {
      for (const toolbar of [true, false]) {
        const edges = await page.evaluate(
          async (options) => {
            await renderUI(options);
            const host = document.getElementById("viewer");
            const bounds = host.getBoundingClientRect();
            const style = getComputedStyle(host);
            const panel = host.querySelector(".byVIEWpanel").getBoundingClientRect();
            const first = host.firstElementChild,
              last = host.lastElementChild;
            const topToolbar = first.classList.contains("byVIEWtoolbar");
            const bottomToolbar = last.classList.contains("byVIEWtoolbar");
            const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
            return [
              ((topToolbar ? first.getBoundingClientRect().top : panel.top) - bounds.top - parseFloat(style.borderTopWidth)) / rem,
              (bounds.bottom - parseFloat(style.borderBottomWidth) - (bottomToolbar ? last.getBoundingClientRect().bottom : panel.bottom)) / rem
            ];
          },
          { controlsPosition, toolbar }
        );
        const expected = [toolbar && controlsPosition === "top" ? 0 : 0.75, toolbar && controlsPosition === "bottom" ? 0 : 0.75];
        assert.ok(
          edges.every((edge, index) => Math.abs(edge - expected[index]) < 0.01),
          `${controlsPosition}, toolbar=${toolbar}: ${edges}`
        );
      }
    }
    await page.evaluate(() => renderUI({ displayContainer: false, statusBar: true }));
    assert.equal(await page.locator(".byVIEWstatus:visible").count(), 0);
    assert.equal(await page.locator(".byVIEWpanel").evaluate((panel) => parseFloat(getComputedStyle(panel).borderTopWidth)), 0);
    assert.match(await page.locator(".byVIEWcontent").textContent(), /needle/);
    await page.evaluate(() => renderUI({ displayContainer: true, statusBar: false }));
    assert.equal(await page.locator(".byVIEWstatus:visible").count(), 0);
    assert.ok(await page.locator(".byVIEWpanel").evaluate((panel) => parseFloat(getComputedStyle(panel).borderTopWidth) > 0));
    await page.evaluate(() => renderUI());
    await page.evaluate(() => renderUI({ fontSizeControls: false, statusBar: false, wordWrap: false }));
    assert.equal(await page.locator(".byVIEWfontSizes").count(), 0);
    assert.equal(await page.locator(".byVIEWstatus:visible").count(), 0);
    assert.equal(await page.locator(".byCODEwrap").count(), 0);
    await page.evaluate(() => renderUI());
    assert.equal(await page.locator(".byCODEwrap").count(), 1);
    await page.evaluate(() => renderUI({ controlsSize: "invalid" }));
    assert.equal(await page.locator(".byVIEWtoolbar").getAttribute("data-size"), "regular");
    for (const scale of [1, 1.5]) {
      for (const controlsSize of ["xs", "small", "regular", "large", "xl"]) {
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
                const toolbarSize = parseFloat(getComputedStyle(host.querySelector(".byVIEWtoolbar")).fontSize);
                const expectedSize = { xs: 0.5, small: 0.7, regular: 0.875, large: 1, xl: 1.25 }[controlsSize] * parseFloat(getComputedStyle(document.documentElement).fontSize);
                return [Math.abs(centerX - icon.x - icon.width / 2), Math.abs(centerY - icon.y - icon.height / 2), Math.abs(centerY - rect.y - rect.height / 2), Math.abs(toolbarSize - expectedSize)];
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

// --- HIGHLIGHT FRAGMENTS ---
test("highlight fragments inherit arbitrary hosts and retain standalone and explicit themes", async () => {
  const browser = await launchBrowser();
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
    assert.equal(await page.locator("#explicit .byCODEhighlight").evaluate((fragment) => getComputedStyle(fragment).color), "rgb(240, 246, 252)", "Explicit dark fragments must also color unclassified source text");
    const appearances = await page.evaluate(() => {
      const source = '<script>document.addEventListener("load", () => {});</script>\r\n';
      return [
        { theme: "dark", palette: "monokai" },
        { theme: "light", palette: "github" },
        { theme: "dark", palette: "github", lineNumbers: true, statusBar: true }
      ].map((options) => {
        const fragment = byCODEviewer.highlight(source, "html", options),
          wrapper = fragment.firstElementChild;
        document.getElementById("host").append(fragment);
        const style = getComputedStyle(wrapper);
        return {
          exact: wrapper.textContent === source,
          mode: wrapper.classList.contains(options.theme),
          palette: wrapper.dataset.theme,
          color: style.color,
          background: style.backgroundColor,
          controls: wrapper.querySelectorAll("button, input, select").length
        };
      });
    });
    assert.deepEqual(appearances, [
      { exact: true, mode: true, palette: "monokai", color: "rgb(248, 248, 242)", background: "rgba(0, 0, 0, 0)", controls: 0 },
      { exact: true, mode: true, palette: "github", color: "rgb(31, 35, 40)", background: "rgba(0, 0, 0, 0)", controls: 0 },
      { exact: true, mode: true, palette: "github", color: "rgb(240, 246, 252)", background: "rgb(13, 17, 23)", controls: 0 }
    ]);
    assert.equal(
      await page.evaluate(() => {
        let rejected = 0;
        for (const options of [{ theme: "sepia" }, { palette: "dark" }]) {
          try {
            byCODEviewer.highlight("text", "plain", options);
          } catch (error) {
            if (error instanceof RangeError) rejected++;
          }
        }
        return rejected;
      }),
      2
    );
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

// --- DOCUMENT AND CONTENT SURFACES ---
test("document and content backgrounds stay independent through theme and toolbar changes", async () => {
  const browser = await launchBrowser();
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
      // The document fade can finish after the independently styled copy control.
      await root.evaluate(async (element) => {
        await Promise.all(element.getAnimations().map((animation) => animation.finished));
      });
      assert.match(await root.evaluate((element) => getComputedStyle(element).backgroundColor), /^rgba\([^)]*, 0\)$/);
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

// --- INTERACTION MOTION ---
test("animation options preserve initial visibility and override system motion preferences", async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    await page.route("https://cdn.jsdelivr.net/**", (route) => (route.request().url().endsWith("fontawesome.min.css") ? route.fulfill({ body: "", contentType: "text/css" }) : route.abort()));
    await page.setContent('<div id="motion-viewer" data-theme="light"></div>');
    await page.addStyleTag({ path: path.join(__dirname, "../code.css") });
    await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
    await page.evaluate(() => {
      window.renderMotion = async (animations, appearAnimation = false) => {
        window.motionController = byCODEviewer(document.getElementById("motion-viewer"), "const answer = 42;", { animations, appearAnimation });
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
    // Disclosure size/exit motion progressively enhances engines supporting intrinsic-size transitions.
    if (await page.evaluate(() => CSS.supports("interpolate-size", "allow-keywords"))) {
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
    } else {
      await root.evaluate((element) => {
        const details = document.createElement("details");
        details.id = "fallback-disclosure";
        details.innerHTML = "<summary>Details</summary><p>Available content</p>";
        element.append(details);
      });
      await page.locator("#fallback-disclosure summary").click();
      await page.locator("#fallback-disclosure p").waitFor({ state: "visible" });
      await page.locator("#fallback-disclosure summary").click();
      await page.locator("#fallback-disclosure p").waitFor({ state: "hidden" });
    }
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
    await page.emulateMedia({ media: "screen", reducedMotion: "reduce" });
    await page.evaluate(() => renderMotion(true));
    await page.waitForFunction(() => document.getElementById("motion-viewer").classList.contains("byVIEWready"));
    const fade = await root.evaluate((element) => {
      const before = getComputedStyle(element).backgroundColor;
      element.querySelector('[aria-label^="Switch to"]').click();
      const transition = element.getAnimations().find((animation) => animation.transitionProperty === "background-color");
      if (!transition) return { active: false };
      transition.pause();
      transition.currentTime = 90;
      const middle = getComputedStyle(element).backgroundColor;
      transition.finish();
      return { active: true, before, middle, after: getComputedStyle(element).backgroundColor, fontTransition: getComputedStyle(element).transitionProperty.includes("font-size") };
    });
    assert.equal(fade.active, true, "Theme backgrounds fade after the first paint");
    assert.notEqual(fade.middle, fade.before);
    assert.notEqual(fade.middle, fade.after);
    assert.equal(fade.fontTransition, false);
    await root.evaluate((element) => {
      element.dataset.theme = "high-contrast";
    });
    assert.equal(await root.evaluate((element) => element.getAnimations().filter((animation) => animation.transitionProperty === "background-color").length), 0);
    const entrance = await page.evaluate(async () => {
      await renderMotion(true, true);
      const element = document.getElementById("motion-viewer");
      const animation = element.getAnimations().find((animation) => animation.animationName === "byVIEWappear");
      if (!animation) return { active: false };
      animation.pause();
      animation.currentTime = 90;
      return { active: true, opacity: Number(getComputedStyle(element).opacity), content: element.textContent.length };
    });
    assert.equal(entrance.active, true, "Entrance motion is explicit even when the system requests reduced motion");
    assert.ok(entrance.opacity > 0 && entrance.opacity < 1);
    assert.ok(entrance.content > 0, "Rendering completes without waiting for the animation");
    await page.evaluate(() => renderMotion(false, true));
    assert.equal(await root.evaluate((element) => element.getAnimations({ subtree: true }).length), 0, "Animations off overrides the requested entrance");
  } finally {
    await browser.close();
  }
});

// --- INITIAL APPEARANCE ---
test("appearance options override markup and preserve independent viewer state", async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ body: "", contentType: "text/css" }));
    await page.setContent('<style>html{font-size:20px}</style><div id="appearance" class="host light" data-theme="light"></div><div id="neighbor" class="dark" data-theme="monokai" style="font-size:2rem">Neighbor</div>');

    await page.addStyleTag({ path: path.join(__dirname, "../code.css") });
    await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
    await page.evaluate(() => {
      window.appearanceTarget = document.getElementById("appearance");
      window.renderAppearance = async (options = {}) => {
        window.appearanceInstance = byCODEviewer(appearanceTarget, "const answer = 42;", options);
        await appearanceInstance?.ready;
      };
    });
    const neighbor = await page.locator("#neighbor").evaluate((element) => element.outerHTML);
    await page.evaluate(() => renderAppearance({ theme: "dark", palette: "github", fontSize: 1.5, animations: false }));
    assert.deepEqual(
      await page
        .locator("#appearance")
        .evaluate((element) => [element.classList.contains("host"), element.classList.contains("dark"), element.classList.contains("light"), element.dataset.theme, element.style.fontSize, getComputedStyle(element).fontSize]),
      [true, true, false, "github", "1.5rem", "30px"]
    );
    const controls = page.locator("#appearance .byVIEWthemeToggle");
    assert.equal(await controls.getAttribute("aria-label"), "Switch to light theme");
    await controls.click();
    assert.deepEqual(await page.locator("#appearance").evaluate((element) => [element.classList.contains("light"), element.dataset.theme, element.style.fontSize]), [true, "github", "1.5rem"]);
    const buttonSize = await controls.evaluate((element) => getComputedStyle(element).fontSize);
    await page.getByRole("button", { name: "Increase text size", exact: true }).click();
    await page.evaluate(() => renderAppearance());
    assert.equal(await page.locator("#appearance").evaluate((element) => element.style.fontSize), "1.625rem");
    await page.getByRole("button", { name: "Reset text size", exact: true }).click();
    assert.equal(await page.locator("#appearance").evaluate((element) => element.style.fontSize), "1.5rem");
    assert.equal(await controls.evaluate((element) => getComputedStyle(element).fontSize), buttonSize);
    await page.evaluate(() => renderAppearance({ fontSize: 1.25 }));
    assert.equal(await page.locator("#appearance").evaluate((element) => getComputedStyle(element).fontSize), "25px");
    await page.getByRole("button", { name: "Increase text size", exact: true }).click();
    await page.getByRole("button", { name: "Reset text size", exact: true }).click();
    assert.equal(await page.locator("#appearance").evaluate((element) => element.style.fontSize), "1.25rem");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "24px";
    });
    assert.equal(await page.locator("#appearance").evaluate((element) => getComputedStyle(element).fontSize), "30px", "The multiplier follows root text-size changes");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "20px";
    });
    for (const [fontSize, expected] of [
      ["1.25rem", 25],
      ["1.25em", 25],
      ["20px", 20],
      ["125%", 25],
      ["1px", 10],
      ["100px", 60],
      ["4em", 60]
    ]) {
      await page.evaluate((fontSize) => renderAppearance({ fontSize }), fontSize);
      assert.equal(await page.locator("#appearance").evaluate((element) => parseFloat(getComputedStyle(element).fontSize)), expected, fontSize);
      const preset = await page.locator("#appearance").evaluate((element) => [element.style.fontSize, element.dataset.byViewDefaultFontSize]);
      assert.equal(preset[0], preset[1]);
      await page.getByRole("button", { name: expected === 60 ? "Decrease text size" : "Increase text size", exact: true }).click();
      await page.getByRole("button", { name: "Reset text size", exact: true }).click();
      assert.equal(await page.locator("#appearance").evaluate((element) => element.style.fontSize), preset[0]);
    }
    await page.evaluate(() => {
      document.body.style.fontSize = "1.5rem";
      return renderAppearance({ fontSize: "1em" });
    });
    assert.equal(await page.locator("#appearance").evaluate((element) => getComputedStyle(element).fontSize), "30px", "em remains relative to the parent");
    await page.evaluate(() => {
      document.body.style.fontSize = "";
      document.documentElement.style.fontSize = "24px";
      return renderAppearance({ fontSize: "100px" });
    });
    assert.equal(await page.locator("#appearance").evaluate((element) => getComputedStyle(element).fontSize), "72px", "CSS values retain the rem limit when the root size changes");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "20px";
    });
    for (const [requested, expected] of [
      [-1, 0.5],
      [0, 0.5],
      [0.25, 0.5],
      [0.5, 0.5],
      [3, 3],
      [4, 3]
    ]) {
      await page.evaluate((fontSize) => renderAppearance({ fontSize }), requested);
      assert.equal(await page.locator("#appearance").evaluate((element) => element.style.fontSize), `${expected}rem`);
      assert.equal(await page.locator("#appearance").evaluate((element) => element.dataset.byViewDefaultFontSize), `${expected}rem`);
      assert.equal(await page.getByRole("button", { name: "Decrease text size", exact: true }).isDisabled(), expected === 0.5);
      assert.equal(await page.getByRole("button", { name: "Increase text size", exact: true }).isDisabled(), expected === 3);
      await page.getByRole("button", { name: expected === 3 ? "Decrease text size" : "Increase text size", exact: true }).click();
      await page.getByRole("button", { name: "Reset text size", exact: true }).click();
      assert.equal(await page.locator("#appearance").evaluate((element) => element.style.fontSize), `${expected}rem`);
    }
    await page.evaluate(() => {
      appearanceTarget.dataset.theme = "dark";
      appearanceTarget.classList.remove("dark");
      appearanceTarget.classList.add("light");
      return renderAppearance({ palette: "high-contrast", toolbar: false });
    });
    assert.deepEqual(await page.locator("#appearance").evaluate((element) => [element.dataset.theme, element.classList.contains("dark"), getComputedStyle(element).colorScheme]), ["high-contrast", true, "dark"]);
    await page.evaluate(() => {
      appearanceTarget.dataset.theme = "dark";
      return renderAppearance({ theme: "light", toolbar: false });
    });
    assert.deepEqual(await page.locator("#appearance").evaluate((element) => [element.dataset.theme, element.classList.contains("dark"), element.classList.contains("light")]), ["light", false, true]);
    await page.evaluate(() => renderAppearance({ theme: "dark", palette: "custom-ocean", fontSize: 1.125, toolbar: false }));
    assert.deepEqual(await page.locator("#appearance").evaluate((element) => [element.dataset.theme, element.classList.contains("dark"), element.style.fontSize]), ["custom-ocean", true, "1.125rem"]);
    const preserved = await page.locator("#appearance").evaluate((element) => [element.className, element.dataset.theme, element.style.fontSize]);
    await page.evaluate(() => renderAppearance());
    assert.deepEqual(await page.locator("#appearance").evaluate((element) => [element.className, element.dataset.theme, element.style.fontSize]), preserved);
    await page.evaluate(() => renderAppearance({ theme: null, palette: null, fontSize: null }));
    assert.deepEqual(await page.locator("#appearance").evaluate((element) => [element.className, element.dataset.theme, element.style.fontSize]), preserved, "Blank exported appearance fields retain the container settings");
    // Invalid options must leave the current document intact rather than partially reinitializing it.
    for (const options of [
      { theme: "sepia" },
      { palette: "dark" },
      { palette: "bad name" },
      { fontSize: NaN },
      { fontSize: Infinity },
      { fontSize: "wrong" },
      { fontSize: "inherit" },
      { fontSize: true },
      { theme: "light", palette: "github", fontSize: "1.25" }
    ]) {
      const before = await page.locator("#appearance").evaluate((element) => element.outerHTML);
      const name = await page.evaluate(async (options) => {
        try {
          await renderAppearance(options);
        } catch (error) {
          return error.name;
        }
      }, options);
      assert.equal(name, "RangeError");
      assert.equal(await page.locator("#appearance").evaluate((element) => element.outerHTML), before, "Invalid appearance must not replace the current document");
    }

    assert.equal(await page.locator("#neighbor").evaluate((element) => element.outerHTML), neighbor);
  } finally {
    await browser.close();
  }
});

// --- MOBILE, OFFLINE ASSETS, AND CSP ---
test("local assets render with a strict CSP and touch controls at mobile width", async () => {
  const browser = await launchBrowser();
  try {
    // Firefox supports the touch viewport, but Playwright does not support isMobile for that engine.
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      ...(browserEngine === "firefox" ? {} : { isMobile: true })
    });
    const externalRequests = [],
      violations = [],
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.exposeFunction("recordViolation", (directive) => violations.push(directive));
    await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (event) => window.recordViolation(event.effectiveDirective)));
    // Reject external requests so a missing local dependency cannot silently fall back to a CDN.
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== "https://viewer.test") {
        externalRequests.push(url.href);
        return route.abort();
      }
      if (url.pathname === "/library.js" || url.pathname === "/library.css") {
        const extension = url.pathname.endsWith(".js") ? "js" : "css";
        return route.fulfill({ path: path.join(__dirname, `../code.${extension}`), contentType: extension === "js" ? "application/javascript" : "text/css" });
      }
      // An external initializer satisfies script-src 'self'; String.raw preserves the fixture's source escapes.
      if (url.pathname === "/init.js")
        return route.fulfill({
          contentType: "application/javascript",
          body: String.raw`
        const target = document.getElementById("viewer");
        const options = { theme: "light", animations: false, fontSize: 1.125 };
        byCODEviewer(target, "const greeting = '日本語';", { language: "js", ...options });
      `
        });
      return route.fulfill({
        contentType: "text/html",
        headers: { "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self'" },
        body: '<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="library.css"><div id="viewer"></div><script src="library.js"></script><script src="init.js"></script>'
      });
    });
    await page.goto("https://viewer.test/");
    await page.waitForFunction(() => document.getElementById("viewer").textContent.includes("日本語"));
    const theme = page.getByRole("button", { name: /Switch to (dark|light) theme/ });
    // Check touch activation and native keyboard activation on the same named control.
    await theme.tap();
    assert.equal(await page.locator("#viewer").evaluate((element) => element.classList.contains("dark")), true);
    await theme.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#viewer").evaluate((element) => element.classList.contains("light")), true);
    assert.equal(await page.locator("#viewer").evaluate((element) => getComputedStyle(element).fontSize), "18px");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(violations, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
