"use strict";
/*
 * File: code.js
 * Desc: Standalone CODE viewer. No runtime dependencies.
 * Copyright (c) 2026 Andres Trujillo [Mateus] byUwUr
 * https://github.com/byuwur/easy-code-viewer
 * MIT License (see LICENSE).
 */
(function (global) {
  /* --- INITIALIZATION --- */
  if (global.byCODEviewer?.initialized) return;

  /* --- METADATA --- */
  byCODEviewer.VERSION = "1.5"; // 2026-11-05

  /* --- CONSTANTS --- */
  const words = (source) => new Set(source.split(" "));
  const javascript = words(
    "async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch this throw try typeof var void while with yield"
  );
  const profiles = {
    javascript: { keywords: javascript, slashComments: true, templates: true, regex: true },
    typescript: {
      keywords: new Set([
        ...javascript,
        ...words(
          "abstract any as asserts bigint boolean constructor declare enum implements infer interface is keyof module namespace never number object private protected public readonly require satisfies string symbol type undefined unique unknown"
        )
      ]),
      slashComments: true,
      templates: true,
      regex: true
    },
    css: { keywords: words("important inherit initial unset revert"), blockComments: true },
    json: { keywords: new Set() },
    yaml: { keywords: new Set(), hashComments: true },
    php: {
      keywords: words(
        "abstract and array as break callable case catch class clone const continue declare default die do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile enum eval exit extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or parent print private protected public readonly require require_once return self static switch throw trait try unset use var while xor yield"
      ),
      slashComments: true,
      hashComments: true
    },
    sql: {
      keywords: words(
        "add all alter and as asc begin between by case cast check column commit constraint create cross database default delete desc distinct drop else end except exists foreign from full function grant group having if in index inner insert intersect into is join key left like limit not null offset on or order outer over partition primary procedure references returning right rollback row select set table then top transaction trigger truncate union unique update use using values view when where window with"
      ),
      dashComments: true,
      blockComments: true
    },
    python: {
      keywords: words("and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield"),
      hashComments: true
    },
    bash: {
      keywords: words("if then else elif fi for while until do done case esac in function select time coproc export readonly local declare typeset unset return break continue source"),
      hashComments: true
    }
  };
  const aliases = { js: "javascript", ts: "typescript", htm: "html", yml: "yaml", py: "python", sh: "bash", shell: "bash", text: "plain", txt: "plain" };
  byCODEviewer.languages = Object.freeze(["html", "css", "javascript", "json", "xml", "yaml", "php", "sql", "python", "bash", "typescript", "plain"]);

  /* --- STATE --- */
  const instances = new WeakMap();
  /* --- HELPERS --- */
  const node = (tag, className = "", text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  };
  /** Yield at a chunk boundary so input events and replacement renders can run. */
  const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

  /* --- APPEARANCE --- */
  /** Explicit appearance options override markup; omitted values preserve the container's state. */
  const applyAppearance = (element, options) => {
    const { theme, palette, fontSize } = options;
    if (theme != null && !["light", "dark"].includes(theme)) throw new RangeError("Theme must be light or dark.");
    if (palette != null && (typeof palette !== "string" || !/^[a-z][\w-]*$/i.test(palette) || ["light", "dark"].includes(palette))) throw new RangeError("Palette must be a CSS theme name; use theme for light or dark.");
    const size = typeof fontSize === "number" ? `${Math.max(0.5, Math.min(3, fontSize))}rem` : typeof fontSize === "string" ? `clamp(0.5rem, ${fontSize}, 3rem)` : "";
    if (fontSize != null && (typeof fontSize === "number" ? !Number.isFinite(fontSize) : typeof fontSize !== "string" || !CSS.supports("font-size", size))) throw new RangeError("Font size must be a finite multiplier or a CSS size.");
    if (theme != null || palette != null) {
      const mode = theme ?? (["light", "dark"].includes(element.dataset.theme) ? element.dataset.theme : element.classList.contains("dark") ? "dark" : "light");
      element.classList.toggle("light", mode === "light");
      element.classList.toggle("dark", mode === "dark");
      if (palette != null) element.dataset.theme = palette;
      else if (["light", "dark"].includes(element.dataset.theme)) element.dataset.theme = mode;
    }
    if (fontSize != null) {
      element.style.fontSize = size;
      element.dataset.byViewDefaultFontSize = element.style.fontSize;
    }
  };

  /* --- CONTROLS --- */
  // Mirrored across the family so each viewer can run without a shared runtime.
  /**
   * Adds container light/dark controls, retaining legacy stylesheet links as a fallback.
   * @param {HTMLElement} element Viewer container and theme owner.
   * @param {HTMLElement} controls Toolbar control group.
   * @param {string} filename Legacy theme stylesheet basename.
   * @returns {HTMLButtonElement} Theme toggle button.
   */
  const appendThemeToggle = (element, controls, filename) => {
    const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const themePattern = new RegExp(`^([^?#]*/)?${escapedFilename}\\.(light|dark)\\.css([?#].*)?$`, "i");
    const stylesheet = [document.getElementById("byVIEWtheme"), ...document.querySelectorAll('link[rel~="stylesheet"]')].find((link) => link && themePattern.test(link.getAttribute("href") || ""));
    // Explicit container state takes precedence over a shared legacy stylesheet.
    const localTheme = (target) => {
      if (["light", "dark"].includes(target.dataset.theme)) return target.dataset.theme;
      if (target.classList.contains("dark")) return "dark";
      if (target.classList.contains("light")) return "light";
      return target.dataset.theme ? "light" : null;
    };
    const legacyTheme = () => (stylesheet?.isConnected ? (stylesheet.getAttribute("href") || "").match(themePattern) : null);
    const getTheme = () => localTheme(element) || legacyTheme()?.[2].toLowerCase() || "light";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "byVIEWthemeToggle";
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z"/></svg><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>';
    const sync = () => {
      const next = getTheme() === "dark" ? "light" : "dark";
      const toggles = !localTheme(element) && legacyTheme() ? [button, ...document.querySelectorAll(".byCODEdocument > .byVIEWtoolbar > .byVIEWcontrols > .byVIEWthemeToggle")] : [button];
      for (const toggle of toggles) {
        // A legacy link must not change the controls of independently themed viewers.
        if (toggle !== button && localTheme(toggle.closest(".byCODEdocument"))) continue;
        toggle.title = `Switch to ${next} theme`;
        toggle.setAttribute("aria-label", toggle.title);
      }
    };
    button.addEventListener("click", () => {
      const next = getTheme() === "dark" ? "light" : "dark";
      if (!localTheme(element) && legacyTheme()) {
        const href = stylesheet.getAttribute("href");
        stylesheet.setAttribute(
          "href",
          href.replace(themePattern, (_, path = "", theme, suffix = "") => `${path}${filename}.${next}.css${suffix}`)
        );
      } else if (element.dataset.theme && !["light", "dark"].includes(element.dataset.theme)) {
        // Named palettes stay selected while only the mode changes.
        element.classList.toggle("light", next === "light");
        element.classList.toggle("dark", next === "dark");
      } else if (element.hasAttribute("data-theme") || (!element.classList.contains("light") && !element.classList.contains("dark"))) {
        element.dataset.theme = next;
      } else {
        element.classList.toggle("light", next === "light");
        element.classList.toggle("dark", next === "dark");
      }
      sync();
    });
    button.addEventListener("focus", sync);
    button.addEventListener("pointerenter", sync);
    sync();
    return controls.appendChild(button);
  };

  /**
   * Adds text size controls for a renderer.
   * @param {HTMLElement} element - Renderer whose font size is changed.
   * @param {HTMLElement} controls - Toolbar that receives the controls.
   * @return {HTMLElement} The text size button group.
   */
  const appendFontSizeControls = (element, controls) => {
    element.dataset.byViewDefaultFontSize ??= element.style.fontSize;
    const sizes = document.createElement("div");
    sizes.className = "byVIEWfontSizes";
    controls.appendChild(sizes);
    const getSize = () => (parseFloat(getComputedStyle(element).fontSize) || 16) / (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    const decrease = document.createElement("button");
    const increase = document.createElement("button");
    const reset = document.createElement("button");
    reset.textContent = "A";
    decrease.textContent = "A-";
    increase.textContent = "A+";
    for (const [button, title] of [
      [decrease, "Decrease text size"],
      [reset, "Reset text size"],
      [increase, "Increase text size"]
    ]) {
      button.type = "button";
      button.className = "byVIEWfontSize";
      button.title = title;
      button.setAttribute("aria-label", title);
      sizes.appendChild(button);
    }
    const sync = () => {
      const size = getSize();
      decrease.disabled = size <= 0.5;
      increase.disabled = size >= 3;
    };
    for (const [button, step] of [
      [decrease, -0.125],
      [increase, 0.125]
    ]) {
      button.addEventListener("click", () => {
        const size = Math.max(0.5, Math.min(3, getSize() + step));
        element.style.fontSize = `${size}rem`;
        sync();
      });
    }
    reset.addEventListener("click", () => {
      element.style.fontSize = element.dataset.byViewDefaultFontSize;
      sync();
    });
    sync();
    return sizes;
  };

  /**
   * Add a copy action for the complete source, including content outside the visible rendered chunk.
   * @param {HTMLElement} controls Toolbar control group.
   * @param {Function} getText Callback that returns the text to copy.
   * @param {string} label Human-readable label.
   * @returns {void}
   */
  const appendCopyButton = (controls, getText, label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "byVIEWcopy";
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true" focusable="false"><!--!Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448L480 448C515.3 448 544 419.3 544 384L544 183.4C544 166 536.9 149.3 524.3 137.2L466.6 81.8C454.7 70.4 438.8 64 422.3 64L288 64zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L352 496L352 512L160 512L160 256L176 256L176 192L160 192z"/></svg>`;
    const caption = document.createElement("span");
    caption.setAttribute("aria-live", "polite");
    button.appendChild(caption);
    const reset = () => {
      if (button.dataset.state === "error") return;
      delete button.dataset.state;
      caption.textContent = "Copy";
      button.title = label;
      button.setAttribute("aria-label", label);
    };
    reset();
    button.addEventListener("mouseleave", reset);
    button.addEventListener("focusout", reset);
    controls.appendChild(button);
    button.addEventListener("click", async (event) => {
      button.disabled = true;
      let message = "Copied!";
      try {
        await navigator.clipboard.writeText(getText(event));
        caption.textContent = message;
        button.dataset.state = "success";
      } catch {
        caption.textContent = "Failed";
        button.dataset.state = "error";
        message = "Copy failed. Check clipboard access.";
      } finally {
        button.disabled = false;
        button.title = `${message} ${label}`;
        button.setAttribute("aria-label", button.title);
      }
    });
  };

  /* --- PARSING --- */
  /** Resolve supported aliases; unknown names deliberately fall back to uncolored source. */
  const languageName = (value) => {
    const name = String(value ?? "plain").toLowerCase();
    return aliases[name] || (byCODEviewer.languages.includes(name) ? name : "plain");
  };
  const token = (type, text) => ({ type, text });
  /** Find a language-specific closing quote without interpreting comment markers inside strings. */
  const quotedEnd = (source, start, end, language) => {
    const quote = source[start],
      triple = language === "python" && source.startsWith(quote.repeat(3), start);
    const delimiter = triple ? quote.repeat(3) : quote;
    let i = start + delimiter.length;
    for (; i < end; i++) {
      if (source[i] === "\\" && language !== "html" && !(language === "yaml" && quote === "'") && !(language === "bash" && quote === "'")) {
        i++;
        continue;
      }
      if (source.startsWith(delimiter, i)) {
        if (!triple && ["sql", "yaml"].includes(language) && source[i + 1] === quote) {
          i++;
          continue;
        }
        return i + delimiter.length;
      }
      if (!triple && source[i] === "\n" && !["yaml", "php", "bash", "sql", "html"].includes(language)) return i;
    }
    return end;
  };
  const lineEnd = (source, start, end) => {
    const i = source.indexOf("\n", start);
    return i < 0 ? end : Math.min(i, end);
  };

  // Tokenization consumes original slices once; strings/comments own their contents before keyword matching.
  /** Yield original source slices while carrying lexical context across lines and nested templates. */
  function* scriptTokens(source, language, start = 0, end = source.length, stop = "", depth = 0) {
    const profile = profiles[language];
    let i = start,
      braces = 0,
      canRegex = true,
      pendingHeredoc = [];
    while (i < end) {
      const begin = i,
        char = source[i],
        next = source[i + 1];
      let type = "plain";
      if (stop === "php" && source.startsWith("?>", i)) {
        yield token("tag", "?>");
        return i + 2;
      }
      if (stop === "brace" && char === "}" && braces === 0) {
        yield token("operator", "}");
        return i + 1;
      }
      if (/\s/.test(char)) {
        if (char === "\n" && pendingHeredoc.length) {
          yield token("plain", "\n");
          i++;
          for (const here of pendingHeredoc) {
            const from = i;
            while (i < end) {
              const to = lineEnd(source, i, end);
              const line = source.slice(i, to).replace(/\r$/, "");
              i = to < end ? to + 1 : to;
              if ((here.tabs ? line.replace(/^\t+/, "") : line) === here.label) break;
            }
            yield token("string", source.slice(from, i));
          }
          pendingHeredoc = [];
          continue;
        }
        i++;
        while (i < end && /\s/.test(source[i]) && !(pendingHeredoc.length && source[i] === "\n")) i++;
      } else if (
        (profile.slashComments && char === "/" && next === "/") ||
        (profile.dashComments && char === "-" && next === "-") ||
        (profile.hashComments && char === "#" && (language === "php" ? next !== "[" : language === "python" || i === 0 || /[\s;|&(]/.test(source[i - 1])))
      ) {
        type = "comment";
        i = lineEnd(source, i, end);
        if (stop === "php") {
          const close = source.indexOf("?>", begin);
          if (close >= 0 && close < i) i = close;
        }
      } else if ((profile.slashComments || profile.blockComments) && char === "/" && next === "*") {
        type = "comment";
        i += 2;
        let nesting = 1;
        while (i < end && nesting) {
          if (language === "sql" && source.startsWith("/*", i)) {
            nesting++;
            i += 2;
          } else if (source.startsWith("*/", i)) {
            nesting--;
            i += 2;
          } else i++;
        }
      } else if (language === "php" && source.startsWith("<<<", i)) {
        const opening = source.slice(i).match(/^<<<[ \t]*(['"]?)([A-Za-z_]\w*)\1[ \t]*\r?\n/);
        if (opening) {
          type = "string";
          i += opening[0].length;
          const close = new RegExp(`^[ \\t]*${opening[2]}(?=[;,\\r\\n]|$)`, "gm");
          close.lastIndex = i;
          const match = close.exec(source);
          i = match && match.index < end ? match.index + match[0].length : end;
        } else {
          type = "operator";
          i += 3;
        }
      } else if (language === "bash" && source.startsWith("<<", i) && source[i + 2] !== "<") {
        const opening = source.slice(i).match(/^<<(-?)[ \t]*(['"]?)([A-Za-z_]\w*)\2/);
        if (opening) {
          type = "operator";
          i += opening[0].length;
          pendingHeredoc.push({ label: opening[3], tabs: opening[1] === "-" });
        } else {
          type = "operator";
          i += 2;
        }
      } else if (language === "sql" && char === "[") {
        type = "property";
        i++;
        while (i < end) {
          if (source[i] === "]") {
            if (source[i + 1] === "]") {
              i += 2;
              continue;
            }
            i++;
            break;
          }
          i++;
        }
      } else if (language === "sql" && char === "$" && /^\$(?:[A-Za-z_]\w*)?\$/.test(source.slice(i))) {
        const delimiter = source.slice(i).match(/^\$(?:[A-Za-z_]\w*)?\$/)[0];
        type = "string";
        const close = source.indexOf(delimiter, i + delimiter.length);
        i = close < 0 ? end : Math.min(end, close + delimiter.length);
      } else if (language === "yaml" && (char === "|" || char === ">") && /(?:[:?-])\s*$/.test(source.slice(source.lastIndexOf("\n", i - 1) + 1, i))) {
        type = "string";
        const lineStart = source.lastIndexOf("\n", i - 1) + 1;
        const indent = source.slice(lineStart).match(/^ */)[0].length;
        i = lineEnd(source, i, end);
        if (i < end) i++;
        while (i < end) {
          const to = lineEnd(source, i, end),
            line = source.slice(i, to);
          if (line.trim() && line.match(/^ */)[0].length <= indent) break;
          i = to < end ? to + 1 : to;
        }
      } else if (profile.templates && char === "`" && depth < 32) {
        let piece = i++;
        while (i < end) {
          if (source[i] === "\\") {
            i = Math.min(end, i + 2);
            continue;
          }
          if (source[i] === "`") {
            i++;
            break;
          }
          if (source.startsWith("${", i)) {
            yield token("string", source.slice(piece, i));
            yield token("operator", "${");
            const nested = scriptTokens(source, language, i + 2, end, "brace", depth + 1);
            let step;
            do {
              step = nested.next();
              if (!step.done) yield step.value;
            } while (!step.done);
            i = step.value;
            piece = i;
            continue;
          }
          i++;
        }
        if (i > piece) yield token("string", source.slice(piece, i));
        canRegex = false;
        continue;
      } else if ((char === '"' || char === "'" || (char === "`" && ["php", "bash", "sql", "javascript", "typescript"].includes(language))) && (language !== "yaml" || i === 0 || /[\s:[{,?\-]/.test(source[i - 1]))) {
        type = language === "sql" && char !== "'" ? "property" : "string";
        i = quotedEnd(source, i, end, language);
        if (["json", "yaml"].includes(language) && /^\s*:/.test(source.slice(i))) type = "property";
        canRegex = false;
      } else if (language === "python" && /^[rubf]{1,2}['"]/i.test(source.slice(i))) {
        const prefix = source.slice(i).match(/^[rubf]{1,2}/i)[0];
        i = quotedEnd(source, i + prefix.length, end, language);
        type = "string";
      } else if (profile.regex && char === "/" && canRegex) {
        let cursor = i + 1,
          inClass = false,
          closed = false;
        for (; cursor < end && source[cursor] !== "\n"; cursor++) {
          if (source[cursor] === "\\") {
            cursor++;
            continue;
          }
          if (source[cursor] === "[") inClass = true;
          else if (source[cursor] === "]") inClass = false;
          else if (source[cursor] === "/" && !inClass) {
            cursor++;
            closed = true;
            break;
          }
        }
        if (closed) {
          while (cursor < end && /[A-Za-z]/.test(source[cursor])) cursor++;
          i = cursor;
          type = "regex";
          canRegex = false;
        } else {
          i++;
          type = "operator";
          canRegex = true;
        }
      } else if ((["php", "bash"].includes(language) && char === "$") || (language === "yaml" && /[&*!]/.test(char))) {
        type = "variable";
        i++;
        if (source[i] === "{") {
          let nested = 1;
          i++;
          while (i < end && nested) {
            if (source[i] === "{") nested++;
            if (source[i] === "}") nested--;
            i++;
          }
        } else while (i < end && /[\w!?@#*.-]/.test(source[i])) i++;
        canRegex = false;
      } else if (/\d/.test(char) || (char === "." && /\d/.test(next ?? ""))) {
        const match = source.slice(i).match(/^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?[\d_]+)?n?)/);
        i += match?.[0].length || 1;
        type = "number";
        canRegex = false;
        if (language === "css") while (i < end && /[A-Za-z%]/.test(source[i])) i++;
      } else if (language === "css" && char === "#" && /^[\da-fA-F]{3,8}\b/.test(source.slice(i + 1))) {
        type = "number";
        i += 1 + source.slice(i + 1).match(/^[\da-fA-F]+/)[0].length;
      } else if (language === "css" && char === "@") {
        type = "keyword";
        i++;
        while (i < end && /[\w-]/.test(source[i])) i++;
      } else if (/[A-Za-z_$\u0080-\uFFFF]/.test(char)) {
        i++;
        const identifier = ["css", "yaml", "bash"].includes(language) ? /[\w\u0080-\uFFFF-]/ : /[\w$\u0080-\uFFFF]/;
        while (i < end && identifier.test(source[i])) i++;
        const text = source.slice(begin, i),
          lower = text.toLowerCase();
        const keyword = language === "sql" || language === "php" ? lower : text;
        if (profile.keywords.has(keyword)) type = "keyword";
        else if ((language === "python" ? ["True", "False", "None"] : ["true", "false", "null", "undefined", "NaN", "Infinity"]).includes(text)) type = "literal";
        else if (["yaml", "css"].includes(language) && /^\s*:/.test(source.slice(i))) type = "property";
        else if (/^\s*\(/.test(source.slice(i))) type = "function";
        canRegex = ["return", "throw", "case", "delete", "typeof", "void", "new", "in", "of", "yield", "await", "else", "do"].includes(text);
      } else {
        type = /[{}[\]();,.:]/.test(char) ? "punctuation" : "operator";
        i++;
        if (char === "{") braces++;
        if (char === "}" && braces > 0) braces--;
        canRegex = !/[)\]}.]/.test(char);
      }
      if (i <= begin) i = begin + 1;
      yield token(type, source.slice(begin, i));
    }
    return i;
  }

  /** Scan tags and raw script/style regions; embedded source keeps its original character positions. */
  function* markupTokens(source, language) {
    let i = 0;
    while (i < source.length) {
      const begin = i;
      if (source.startsWith("<!--", i) || source.startsWith("<![CDATA[", i) || source.startsWith("<?", i) || source.startsWith("<!", i)) {
        const comment = source.startsWith("<!--", i),
          cdata = source.startsWith("<![CDATA[", i);
        const delimiter = comment ? "-->" : cdata ? "]]>" : source.startsWith("<?", i) ? "?>" : ">";
        const close = source.indexOf(delimiter, i + 2);
        i = close < 0 ? source.length : close + delimiter.length;
        yield token(comment ? "comment" : cdata ? "string" : "tag", source.slice(begin, i));
      } else if (source[i] === "<" && /^<\/?[A-Za-z_:]/.test(source.slice(i))) {
        const opening = source.slice(i).match(/^<(\/?)([\w:.-]+)/),
          name = opening[2].toLowerCase();
        i += opening[0].length;
        yield token("tag", opening[0]);
        let selfClosing = false,
          complete = false;
        while (i < source.length) {
          const from = i;
          if (source.startsWith("/>", i) || source[i] === ">") {
            selfClosing = source[i] === "/";
            i += selfClosing ? 2 : 1;
            yield token("tag", source.slice(from, i));
            complete = true;
            break;
          }
          if (/\s/.test(source[i])) {
            while (i < source.length && /\s/.test(source[i])) i++;
            yield token("plain", source.slice(from, i));
          } else if (source[i] === "=") {
            i++;
            yield token("operator", "=");
          } else if (source[i] === '"' || source[i] === "'") {
            i = quotedEnd(source, i, source.length, "html");
            yield token("string", source.slice(from, i));
          } else {
            i++;
            while (i < source.length && !/[\s=>/]/.test(source[i])) i++;
            yield token("attribute", source.slice(from, i));
          }
        }
        if (language === "html" && complete && !opening[1] && !selfClosing && ["script", "style"].includes(name)) {
          const closing = new RegExp(`</${name}(?=[\\s>])`, "ig");
          closing.lastIndex = i;
          const match = closing.exec(source),
            end = match ? match.index : source.length;
          yield* scriptTokens(source, name === "style" ? "css" : "javascript", i, end);
          i = end;
        }
      } else if (source[i] === "&" && /^&(?:#\d+|#x[\da-fA-F]+|[\w]+);/.test(source.slice(i))) {
        const entity = source.slice(i).match(/^&(?:#\d+|#x[\da-fA-F]+|[\w]+);/)[0];
        i += entity.length;
        yield token("literal", entity);
      } else {
        i++;
        while (i < source.length && source[i] !== "<" && source[i] !== "&") i++;
        yield token("plain", source.slice(begin, i));
      }
    }
  }

  // PHP is lexed first, then masked in its HTML host. Overlay keeps host strings/tags intact across server blocks.
  /** Mask PHP regions while scanning the HTML host, then overlay their tokens at the same offsets. */
  function* phpTokens(source) {
    const regions = [],
      host = [];
    let i = 0;
    const opening = /<\?(?:php(?=\s|$)|=)/gi;
    let match;
    while ((match = opening.exec(source))) {
      host.push(source.slice(i, match.index));
      const tokens = [token("tag", match[0])];
      const iterator = scriptTokens(source, "php", match.index + match[0].length, source.length, "php");
      let step;
      do {
        step = iterator.next();
        if (!step.done) tokens.push(step.value);
      } while (!step.done);
      regions.push({ start: match.index, end: step.value, tokens });
      host.push(source.slice(match.index, step.value).replace(/[^\r\n]/g, " "));
      i = step.value;
      opening.lastIndex = i;
    }
    if (!regions.length) {
      yield* scriptTokens(source, "php");
      return;
    }
    host.push(source.slice(i));
    let position = 0,
      regionIndex = 0;
    for (const part of markupTokens(host.join(""), "html")) {
      const end = position + part.text.length;
      while (position < end) {
        const region = regions[regionIndex];
        if (!region || region.start >= end) {
          yield token(part.type, source.slice(position, end));
          position = end;
        } else if (position < region.start) {
          yield token(part.type, source.slice(position, region.start));
          position = region.start;
        } else {
          if (position === region.start) yield* region.tokens;
          position = Math.min(end, region.end);
          if (position === region.end) regionIndex++;
        }
      }
    }
  }
  /* --- RENDERING --- */
  const appendToken = (parent, part, text = part.text) => {
    if (part.type === "plain") parent.appendChild(document.createTextNode(text));
    else parent.appendChild(node("span", `byCODEtoken byCODE${part.type}`, text));
  };

  const codeStatus = (source, language, count) => (!source.length ? "No source code." : `${language} \u00b7 ${count} ${count === 1 ? "line" : "lines"}`);

  /* --- LIFECYCLE --- */
  // One instance owns the container; replacement disposes its pending work first.
  /** Replace the previous owner and return its cancellable state. Only the current owner may clear the host. */
  const mount = (element, options, getText) => {
    if (!(element instanceof HTMLElement)) throw new TypeError("byCODEviewer: element must be an HTMLElement.");
    applyAppearance(element, options);
    instances.get(element)?.destroy();
    const state = { active: true };
    state.destroy = () => {
      if (!state.active) return;
      state.active = false;
      if (instances.get(element) === state) {
        instances.delete(element);
        element.replaceChildren();
        element.classList.remove("byCODEdocument", "byVIEWcompact", "byVIEWbottom", "byVIEWmotion");
        element.removeAttribute("aria-busy");
      }
    };
    instances.set(element, state);
    element.replaceChildren();
    element.classList.add("byCODEdocument");
    element.classList.toggle("byVIEWmotion", options.animations !== false);
    element.classList.toggle("byVIEWplain", options.displayContainer === false);
    element.classList.toggle("byVIEWcompact", options.controlsCompact !== false);
    element.classList.toggle("byVIEWbottom", options.controlsPosition === "bottom");
    const content = node("div", "byVIEWcontent");
    const toolbar = node("div", "byVIEWtoolbar");
    toolbar.dataset.size = ["xs", "small", "regular", "large", "xl"].includes(options.controlsSize) ? options.controlsSize : "regular";
    const info = node("small", "byVIEWinfo");
    for (const [text, href] of [
      ["easy-code-viewer", "https://github.com/byuwur/easy-code-viewer"],
      ["@byUwUr", "https://byuwur.co"]
    ]) {
      const link = node("a", "", text);
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      if (info.childNodes.length) info.append(` · v${byCODEviewer.VERSION} · `);
      info.appendChild(link);
    }
    if (options.credits !== false) toolbar.appendChild(info);
    const controls = node("div", "byVIEWcontrols");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Viewer controls");
    if (options.themeToggle !== false) appendThemeToggle(element, controls, "code");
    if (options.fontSizeControls !== false) appendFontSizeControls(element, controls);
    if (options.copyButton !== false) appendCopyButton(controls, getText, "Copy source");
    if (controls.childNodes.length) toolbar.appendChild(controls);
    if (options.toolbar === false || !toolbar.childNodes.length) {
      element.classList.remove("byVIEWbottom");
      element.appendChild(content);
    } else element.append(...(options.controlsPosition === "bottom" ? [content, toolbar] : [toolbar, content]));
    state.content = content;
    state.error = (error) => {
      if (!state.active) return;
      element.setAttribute("aria-busy", "false");
      const message = node("p", "byVIEWerror", error.message);
      message.setAttribute("role", "alert");
      content.replaceChildren(message);
    };
    return state;
  };

  /* --- PUBLIC API --- */
  // Yield original slices, including whitespace. Validation runs when the iterator is consumed.
  /** Return a lazy token stream; input and resource-limit errors occur when iteration advances. */
  byCODEviewer.tokenize = function* (source, language) {
    if (typeof source !== "string") throw new TypeError("Code source must be a string.");
    if (source.length > 2000000 || source.split("\n").length > 20000) throw new RangeError("Code exceeds 2 million characters or 20,000 lines.");
    const name = languageName(language);
    const iterator = name === "plain" ? [token("plain", source)] : name === "php" ? phpTokens(source) : ["html", "xml"].includes(name) ? markupTokens(source, name) : scriptTokens(source, name);
    let count = 0;
    for (const part of iterator) {
      if (++count > 100000) throw new RangeError("Code exceeds 100,000 lexical tokens.");
      if (part.text) yield part;
    }
  };

  /** Stateful lexical highlighting; source is never interpreted as HTML or executed. */
  function byCODEviewer(element, source, options = {}) {
    if (source === undefined) source = element?.textContent ?? "";
    if (typeof source !== "string") throw new TypeError("Code source must be a string.");
    options = { language: "plain", lineNumbers: true, wordWrap: true, languageSelect: false, ...options };
    let language = languageName(options.language),
      generation = 0;
    const state = mount(element, options, () => source);
    const actions = node("div", "byVIEWactions");
    const selector = node("select");
    selector.setAttribute("aria-label", "Code language");
    for (const value of byCODEviewer.languages) {
      const option = node("option", "", value);
      option.value = value;
      selector.appendChild(option);
    }
    selector.value = language;
    if (options.languageSelect !== false) actions.appendChild(selector);
    const wrapLabel = node("label"),
      wrap = node("input");
    wrap.type = "checkbox";
    wrap.checked = Boolean(options.wordWrap);
    wrapLabel.append(wrap, " Word wrap");
    if (options.wrapControl === true) actions.appendChild(wrapLabel);
    const status = node("p", "byVIEWstatus", "Highlighting\u2026");
    status.setAttribute("role", "status");
    const scroll = node("div", "byCODEscroll");
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", "Source code");
    const lines = node("div", "byCODElines");
    scroll.appendChild(lines);
    const panel = node("div", "byVIEWpanel");
    panel.append(status, scroll);
    state.content.append(actions, panel);
    const syncWrap = () => {
      lines.classList.toggle("byCODEwrap", wrap.checked);
    };
    syncWrap();
    wrap.addEventListener("change", syncWrap);
    /* --- RENDERING --- */
    const render = async () => {
      // A later language selection supersedes any render paused between token chunks.
      const version = ++generation;
      element.setAttribute("aria-busy", "true");
      try {
        await pause();
        if (!state.active || version !== generation) return false;
        const fragment = document.createDocumentFragment();
        let line,
          text,
          lineNumber = 0,
          count = 0;
        const newLine = () => {
          line = node("div", "byCODEline");
          line.dataset.line = String(++lineNumber);
          if (options.lineNumbers !== false) {
            const number = node("span", "byCODElineNumber", lineNumber);
            number.setAttribute("aria-hidden", "true");
            line.appendChild(number);
          }
          text = node("span", "byCODEtext");
          line.appendChild(text);
          fragment.appendChild(line);
        };
        newLine();
        for (const part of byCODEviewer.tokenize(source, language)) {
          const pieces = part.text.split("\n");
          for (let i = 0; i < pieces.length; i++) {
            if (pieces[i]) appendToken(text, part, pieces[i].replace(/\r$/, ""));
            if (i < pieces.length - 1) newLine();
            if (++count % 500 === 0) {
              await pause();
              if (!state.active || version !== generation) return false;
            }
          }
        }
        if (!state.active || version !== generation) return false;
        lines.style.setProperty("--by-code-line-digits", String(Math.max(2, String(lineNumber).length)));
        lines.replaceChildren(fragment);
        status.hidden = options.statusBar === false && source.length > 0;
        status.textContent = codeStatus(source, language, lineNumber);
        element.setAttribute("aria-busy", "false");
        return true;
      } catch (error) {
        state.error(error);
        return false;
      }
    };
    selector.addEventListener("change", () => {
      language = selector.value;
      render();
    });
    state.ready = render();
    return { ready: state.ready, destroy: state.destroy };
  }

  /** Optional code-block presentation preserves the fragment's exact source text. */
  byCODEviewer.highlight = (source, language = "plain", options = {}) => {
    const fragment = document.createDocumentFragment(),
      wrapper = node("span", "byCODEhighlight"),
      tokens = byCODEviewer.tokenize(source, options.highlighting === false ? "plain" : language);
    applyAppearance(wrapper, { theme: options.theme, palette: options.palette });
    if (!options.lineNumbers && !options.statusBar) {
      for (const part of tokens) appendToken(wrapper, part);
    } else {
      wrapper.classList.add("byCODEblock");
      const lines = node("span", "byCODElines");
      let count = 0,
        text;
      const newLine = () => {
        const line = node("span", "byCODEline");
        count += 1;
        if (options.lineNumbers) {
          const number = node("span", "byCODElineNumber");
          number.dataset.line = String(count);
          number.setAttribute("aria-hidden", "true");
          line.appendChild(number);
        }
        text = node("span", "byCODEtext");
        line.appendChild(text);
        lines.appendChild(line);
      };
      newLine();
      for (const part of tokens) {
        for (const piece of part.text.split(/(\r?\n)/)) {
          if (piece === "\n" || piece === "\r\n") {
            // Keep original separators outside the visual rows for exact textContent.
            lines.appendChild(document.createTextNode(piece));
            newLine();
          } else if (piece) appendToken(text, part, piece);
        }
      }
      lines.style.setProperty("--by-code-line-digits", String(Math.max(2, String(count).length)));
      const label = codeStatus(source, languageName(language), count);
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("aria-label", label);
      // Labels live in attributes/CSS so copying textContent returns only the original code.
      if (options.statusBar) {
        const status = node("span", "byCODEstatus");
        status.dataset.label = label;
        status.setAttribute("aria-hidden", "true");
        wrapper.appendChild(status);
      }
      wrapper.appendChild(lines);
    }
    fragment.appendChild(wrapper);
    return fragment;
  };
  /* --- EXPORT --- */
  global.byCODEviewer = byCODEviewer;
  byCODEviewer.initialized = true;
})(typeof window !== "undefined" ? window : this);
