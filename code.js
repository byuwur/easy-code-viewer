"use strict";
/*
 * File: code.js
 * Desc: Standalone CODE viewer. No runtime dependencies.
 * Copyright (c) 2026 Andres Trujillo [Mateus] byUwUr
 * https://github.com/byuwur/easy-code-viewer
 * MIT License (see LICENSE).
 */
(function (global) {
  // --- INITIALIZATION ---
  if (global.byCODEviewer?.initialized) return;

  // --- METADATA ---
  byCODEviewer.VERSION = "1.7"; // 2026-11-06

  // --- CONSTANTS ---
  // Language data stays separate from the shared scanner; lookup sets are built once.
  // prettier-ignore
  const profiles = {
    javascript: {keywords: ["async", "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "export", "extends", "finally", "for", "from", "function", "get", "if", "import", "in", "instanceof", "let", "new", "of", "return", "set", "static", "super", "switch", "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield"], slashComments: true, templates: true, regex: true},
    typescript: {keywords: ["async", "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "export", "extends", "finally", "for", "from", "function", "get", "if", "import", "in", "instanceof", "let", "new", "of", "return", "set", "static", "super", "switch", "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield", "abstract", "any", "as", "asserts", "bigint", "boolean", "constructor", "declare", "enum", "implements", "infer", "interface", "is", "keyof", "module", "namespace", "never", "number", "object", "private", "protected", "public", "readonly", "require", "satisfies", "string", "symbol", "type", "undefined", "unique", "unknown"], slashComments: true, templates: true, regex: true},
    css: {keywords: ["important", "inherit", "initial", "unset", "revert"], blockComments: true, css: true},
    json: {keywords: []},
    yaml: {keywords: [], hashComments: true},
    php: {keywords: ["abstract", "and", "array", "as", "break", "callable", "case", "catch", "class", "clone", "const", "continue", "declare", "default", "die", "do", "echo", "else", "elseif", "empty", "enddeclare", "endfor", "endforeach", "endif", "endswitch", "endwhile", "enum", "eval", "exit", "extends", "final", "finally", "fn", "for", "foreach", "function", "global", "goto", "if", "implements", "include", "include_once", "instanceof", "insteadof", "interface", "isset", "list", "match", "namespace", "new", "or", "parent", "print", "private", "protected", "public", "readonly", "require", "require_once", "return", "self", "static", "switch", "throw", "trait", "try", "unset", "use", "var", "while", "xor", "yield"], slashComments: true, hashComments: true, caseInsensitive: true},
    sql: {keywords: ["add", "all", "alter", "and", "as", "asc", "begin", "between", "by", "case", "cast", "check", "column", "commit", "constraint", "create", "cross", "database", "default", "delete", "desc", "distinct", "drop", "else", "end", "except", "exists", "foreign", "from", "full", "function", "grant", "group", "having", "if", "in", "index", "inner", "insert", "intersect", "into", "is", "join", "key", "left", "like", "limit", "not", "null", "offset", "on", "or", "order", "outer", "over", "partition", "primary", "procedure", "references", "returning", "right", "rollback", "row", "select", "set", "table", "then", "top", "transaction", "trigger", "truncate", "union", "unique", "update", "use", "using", "values", "view", "when", "where", "window", "with"], dashComments: true, blockComments: true, caseInsensitive: true, nestedComments: true},
    python: {keywords: ["and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield"], hashComments: true, tripleQuotes: true, literals: ["True", "False", "None"]},
    bash: {keywords: ["if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done", "case", "esac", "in", "function", "select", "time", "coproc", "export", "readonly", "local", "declare", "typeset", "unset", "return", "break", "continue", "source"], hashComments: true, dollarVariables: true, backticks: true, multilineQuotes: true},
    jsx: {keywords: ["async", "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "export", "extends", "finally", "for", "from", "function", "get", "if", "import", "in", "instanceof", "let", "new", "of", "return", "set", "static", "super", "switch", "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield"], slashComments: true, templates: true, regex: true, jsx: true},
    tsx: {keywords: ["async", "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "export", "extends", "finally", "for", "from", "function", "get", "if", "import", "in", "instanceof", "let", "new", "of", "return", "set", "static", "super", "switch", "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield", "abstract", "any", "as", "asserts", "bigint", "boolean", "constructor", "declare", "enum", "implements", "infer", "interface", "is", "keyof", "module", "namespace", "never", "number", "object", "private", "protected", "public", "readonly", "require", "satisfies", "string", "symbol", "type", "undefined", "unique", "unknown"], slashComments: true, templates: true, regex: true, jsx: true},
    scss: {keywords: ["important", "inherit", "initial", "unset", "revert"], blockComments: true, css: true, slashComments: true, dollarVariables: true},
    less: {keywords: ["important", "inherit", "initial", "unset", "revert"], blockComments: true, css: true, slashComments: true, atVariables: true},
    jsonc: {keywords: [], slashComments: true, properties: true},
    json5: {keywords: ["Infinity", "NaN"], slashComments: true, properties: true, multilineQuotes: true},
    c: {keywords: ["auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum", "extern", "float", "for", "goto", "if", "inline", "int", "long", "register", "restrict", "return", "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while", "_Alignas", "_Alignof", "_Atomic", "_Bool", "_Complex", "_Generic", "_Imaginary", "_Noreturn", "_Static_assert", "_Thread_local"], slashComments: true, preprocessor: true},
    cpp: {keywords: ["alignas", "alignof", "and", "and_eq", "asm", "auto", "bitand", "bitor", "bool", "break", "case", "catch", "char", "char8_t", "char16_t", "char32_t", "class", "compl", "concept", "const", "consteval", "constexpr", "constinit", "const_cast", "continue", "co_await", "co_return", "co_yield", "decltype", "default", "delete", "do", "double", "dynamic_cast", "else", "enum", "explicit", "export", "extern", "float", "for", "friend", "goto", "if", "inline", "int", "long", "mutable", "namespace", "new", "noexcept", "not", "not_eq", "operator", "or", "or_eq", "private", "protected", "public", "register", "reinterpret_cast", "requires", "return", "short", "signed", "sizeof", "static", "static_assert", "static_cast", "struct", "switch", "template", "this", "thread_local", "throw", "try", "typedef", "typeid", "typename", "union", "unsigned", "using", "virtual", "void", "volatile", "wchar_t", "while", "xor", "xor_eq"], slashComments: true, preprocessor: true},
    csharp: {keywords: ["abstract", "as", "async", "await", "base", "bool", "break", "byte", "case", "catch", "char", "checked", "class", "const", "continue", "decimal", "default", "delegate", "do", "double", "dynamic", "else", "enum", "event", "explicit", "extern", "finally", "fixed", "float", "for", "foreach", "get", "global", "goto", "if", "implicit", "in", "init", "int", "interface", "internal", "is", "lock", "long", "namespace", "new", "not", "null", "object", "operator", "or", "out", "override", "params", "partial", "private", "protected", "public", "readonly", "record", "ref", "required", "return", "sbyte", "scoped", "sealed", "set", "short", "sizeof", "stackalloc", "static", "string", "struct", "switch", "this", "throw", "try", "typeof", "uint", "ulong", "unchecked", "unmanaged", "unsafe", "ushort", "using", "value", "var", "virtual", "void", "volatile", "when", "where", "while", "with", "yield"], slashComments: true, tripleQuotes: true, preprocessor: true},
    java: {keywords: ["abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "default", "do", "double", "else", "enum", "exports", "extends", "final", "finally", "float", "for", "goto", "if", "implements", "import", "instanceof", "int", "interface", "long", "module", "native", "new", "non-sealed", "open", "opens", "package", "permits", "private", "protected", "provides", "public", "record", "requires", "return", "sealed", "short", "static", "strictfp", "super", "switch", "synchronized", "this", "throw", "throws", "to", "transient", "transitive", "try", "uses", "var", "void", "volatile", "when", "while", "with", "yield"], slashComments: true, tripleQuotes: true, annotations: true},
    kotlin: {keywords: ["abstract", "actual", "annotation", "as", "break", "by", "catch", "class", "companion", "const", "constructor", "continue", "crossinline", "data", "delegate", "do", "dynamic", "else", "enum", "expect", "external", "field", "file", "final", "finally", "for", "fun", "get", "if", "import", "in", "infix", "init", "inline", "inner", "interface", "internal", "is", "lateinit", "noinline", "object", "open", "operator", "out", "override", "package", "param", "private", "property", "protected", "public", "receiver", "reified", "return", "sealed", "set", "setparam", "super", "suspend", "tailrec", "this", "throw", "try", "typealias", "typeof", "val", "value", "var", "vararg", "when", "where", "while"], slashComments: true, tripleQuotes: true, rawTriple: true, nestedComments: true, annotations: true},
    scala: {keywords: ["abstract", "case", "catch", "class", "def", "do", "else", "enum", "export", "extends", "extension", "final", "finally", "for", "forSome", "given", "if", "implicit", "import", "infix", "inline", "lazy", "match", "new", "object", "opaque", "open", "override", "package", "private", "protected", "return", "sealed", "super", "then", "this", "throw", "trait", "transparent", "try", "type", "using", "val", "var", "while", "with", "yield"], slashComments: true, tripleQuotes: true, rawTriple: true, nestedComments: true, annotations: true},
    swift: {keywords: ["actor", "any", "as", "associatedtype", "async", "await", "borrowing", "break", "case", "catch", "class", "consuming", "continue", "convenience", "copy", "default", "defer", "deinit", "didSet", "distributed", "do", "dynamic", "else", "enum", "extension", "fallthrough", "fileprivate", "final", "for", "func", "get", "guard", "if", "import", "in", "indirect", "infix", "init", "inout", "internal", "is", "isolated", "lazy", "let", "macro", "mutating", "nonisolated", "nonmutating", "open", "operator", "optional", "override", "package", "postfix", "precedencegroup", "prefix", "private", "protocol", "public", "repeat", "required", "rethrows", "return", "self", "Self", "set", "some", "static", "struct", "subscript", "super", "switch", "throws", "throwing", "try", "typealias", "unowned", "var", "weak", "where", "while", "willSet"], slashComments: true, tripleQuotes: true, nestedComments: true},
    objectivec: {keywords: ["auto", "BOOL", "break", "case", "char", "class", "const", "continue", "default", "do", "double", "else", "enum", "extern", "float", "for", "id", "if", "in", "inline", "int", "long", "nonatomic", "nullable", "property", "protocol", "readonly", "readwrite", "register", "return", "self", "short", "signed", "sizeof", "static", "strong", "struct", "super", "switch", "synthesize", "typedef", "union", "unsigned", "void", "volatile", "weak", "while"], slashComments: true, preprocessor: true, annotations: true},
    go: {keywords: ["break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough", "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch", "type", "var"], slashComments: true, backticks: true, rawBackticks: true, multilineQuotes: true, literals: ["true", "false", "nil", "iota"]},
    rust: {keywords: ["as", "async", "await", "become", "box", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "final", "fn", "for", "gen", "if", "impl", "in", "let", "loop", "macro", "match", "mod", "move", "mut", "override", "priv", "pub", "ref", "return", "self", "Self", "static", "struct", "super", "trait", "try", "type", "typeof", "union", "unsafe", "unsized", "use", "virtual", "where", "while", "yield"], slashComments: true, nestedComments: true, lifetimes: true},
    zig: {keywords: ["addrspace", "align", "allowzero", "and", "anyframe", "anytype", "asm", "async", "await", "break", "callconv", "catch", "comptime", "const", "continue", "defer", "else", "enum", "errdefer", "error", "export", "extern", "fn", "for", "if", "inline", "linksection", "noalias", "noinline", "nosuspend", "opaque", "or", "orelse", "packed", "pub", "resume", "return", "section", "struct", "suspend", "switch", "test", "threadlocal", "try", "union", "unreachable", "usingnamespace", "var", "volatile", "while"], slashComments: true, literals: ["true", "false", "null", "undefined", "unreachable"]},
    dart: {keywords: ["abstract", "as", "assert", "async", "augment", "await", "base", "break", "case", "catch", "class", "const", "continue", "covariant", "default", "deferred", "do", "dynamic", "else", "enum", "export", "extends", "extension", "external", "factory", "final", "finally", "for", "Function", "get", "hide", "if", "implements", "import", "in", "interface", "is", "late", "library", "mixin", "new", "of", "on", "operator", "part", "required", "rethrow", "return", "sealed", "set", "show", "static", "super", "switch", "sync", "this", "throw", "try", "type", "typedef", "var", "void", "when", "while", "with", "yield"], slashComments: true, tripleQuotes: true, annotations: true},
    d: {keywords: ["abstract", "alias", "align", "asm", "assert", "auto", "body", "bool", "break", "byte", "case", "cast", "catch", "cdouble", "cent", "cfloat", "char", "class", "const", "continue", "creal", "dchar", "debug", "default", "delegate", "delete", "deprecated", "do", "double", "else", "enum", "export", "extern", "final", "finally", "float", "for", "foreach", "foreach_reverse", "function", "goto", "idouble", "if", "ifloat", "immutable", "import", "in", "inout", "int", "interface", "invariant", "ireal", "is", "lazy", "long", "mixin", "module", "new", "nothrow", "out", "override", "package", "pragma", "private", "protected", "public", "pure", "real", "ref", "return", "scope", "shared", "short", "static", "struct", "super", "switch", "synchronized", "template", "this", "throw", "try", "typedef", "typeid", "typeof", "ubyte", "ucent", "uint", "ulong", "union", "unittest", "ushort", "version", "void", "volatile", "wchar", "while", "with", "__gshared"], slashComments: true, blocks: [["/*", "*/"], ["/+", "+/"]], nestedComments: true, backticks: true, rawBackticks: true},
    groovy: {keywords: ["abstract", "as", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "def", "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "goto", "if", "implements", "import", "in", "instanceof", "int", "interface", "long", "native", "new", "package", "private", "protected", "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this", "threadsafe", "throw", "throws", "trait", "transient", "try", "var", "void", "volatile", "while"], slashComments: true, tripleQuotes: true},
    ruby: {keywords: ["BEGIN", "END", "alias", "and", "begin", "break", "case", "class", "def", "defined", "do", "else", "elsif", "end", "ensure", "for", "if", "in", "module", "next", "not", "or", "redo", "rescue", "retry", "return", "self", "super", "then", "undef", "unless", "until", "when", "while", "yield"], hashComments: true, heredoc: true, literals: ["true", "false", "nil", "__FILE__", "__LINE__"]},
    perl: {keywords: ["and", "cmp", "continue", "default", "do", "else", "elsif", "eq", "eval", "for", "foreach", "ge", "given", "goto", "grep", "gt", "if", "last", "le", "local", "lt", "map", "my", "ne", "next", "no", "not", "or", "our", "package", "print", "redo", "require", "return", "say", "scalar", "sort", "state", "sub", "unless", "until", "use", "when", "while", "xor"], hashComments: true, dollarVariables: true, atVariables: true, percentVariables: true, backticks: true},
    lua: {keywords: ["and", "break", "do", "else", "elseif", "end", "for", "function", "goto", "if", "in", "local", "not", "or", "repeat", "return", "then", "until", "while"], dashComments: true, literals: ["true", "false", "nil"]},
    r: {keywords: ["break", "else", "for", "function", "if", "in", "next", "repeat", "return", "switch", "while"], hashComments: true, backticks: true, multilineQuotes: true, literals: ["TRUE", "FALSE", "NULL", "NA", "NaN", "Inf", "NA_integer_", "NA_real_", "NA_character_", "NA_complex_"]},
    julia: {keywords: ["abstract", "baremodule", "begin", "break", "catch", "const", "continue", "do", "else", "elseif", "end", "export", "finally", "for", "function", "global", "if", "import", "in", "isa", "let", "local", "macro", "module", "mutable", "outer", "primitive", "public", "quote", "return", "struct", "try", "type", "using", "where", "while"], hashComments: true, blocks: [["#=", "=#"]], nestedComments: true, tripleQuotes: true, multilineQuotes: true, literals: ["true", "false", "nothing", "missing", "Inf", "NaN"]},
    matlab: {keywords: ["arguments", "break", "case", "catch", "classdef", "continue", "else", "elseif", "end", "enumeration", "events", "for", "function", "global", "if", "methods", "otherwise", "parfor", "persistent", "properties", "return", "spmd", "switch", "try", "while"], lineComments: ["%"], blocks: [["%{", "%}"]], doubledQuotes: true, multilineQuotes: true},
    powershell: {keywords: ["begin", "break", "catch", "class", "clean", "continue", "data", "define", "do", "dynamicparam", "else", "elseif", "end", "enum", "exit", "filter", "finally", "for", "foreach", "from", "function", "if", "in", "param", "process", "return", "switch", "throw", "trap", "try", "until", "using", "var", "while", "workflow"], hashComments: true, blocks: [["<#", "#>"]], caseInsensitive: true, dollarVariables: true, hyphenated: true, doubledQuotes: true, multilineQuotes: true},
    batch: {keywords: ["assoc", "break", "call", "cd", "chdir", "cls", "color", "copy", "date", "del", "dir", "do", "echo", "else", "endlocal", "erase", "exit", "for", "ftype", "goto", "if", "in", "md", "mkdir", "move", "not", "path", "pause", "popd", "prompt", "pushd", "rd", "rem", "ren", "rename", "rmdir", "set", "setlocal", "shift", "start", "time", "title", "type", "ver", "verify", "vol"], lineStartComments: ["rem", "::"], caseInsensitive: true, percentVariables: true, singleQuotes: false},
    awk: {keywords: ["BEGIN", "END", "BEGINFILE", "ENDFILE", "break", "case", "continue", "default", "delete", "do", "else", "exit", "for", "function", "getline", "if", "in", "next", "nextfile", "print", "printf", "return", "switch", "while"], hashComments: true, dollarVariables: true, regex: true},
    haskell: { apostropheIdentifiers: true,keywords: ["as", "case", "class", "data", "default", "deriving", "do", "else", "family", "forall", "foreign", "hiding", "if", "import", "in", "infix", "infixl", "infixr", "instance", "let", "mdo", "module", "newtype", "of", "pattern", "qualified", "rec", "role", "safe", "then", "type", "unsafe", "where"], dashComments: true, blocks: [["{-", "-}"]], nestedComments: true},
    elixir: {keywords: ["after", "alias", "and", "case", "catch", "cond", "def", "defdelegate", "defexception", "defguard", "defguardp", "defimpl", "defmacro", "defmacrop", "defmodule", "defp", "defprotocol", "defstruct", "do", "else", "end", "fn", "for", "if", "import", "in", "not", "or", "quote", "raise", "receive", "require", "rescue", "super", "throw", "try", "unless", "unquote", "unquote_splicing", "use", "when", "with"], hashComments: true, tripleQuotes: true, symbols: true, literals: ["true", "false", "nil"]},
    erlang: {keywords: ["after", "and", "andalso", "band", "begin", "bnot", "bor", "bsl", "bsr", "bxor", "case", "catch", "cond", "div", "end", "fun", "if", "let", "maybe", "not", "of", "or", "orelse", "receive", "rem", "try", "when", "xor"], lineComments: ["%"], literals: ["true", "false", "undefined"]},
    fsharp: { apostropheIdentifiers: true,keywords: ["abstract", "and", "as", "assert", "async", "base", "begin", "class", "default", "delegate", "do", "done", "downcast", "downto", "elif", "else", "end", "exception", "extern", "false", "finally", "fixed", "for", "fun", "function", "global", "if", "in", "inherit", "inline", "interface", "internal", "lazy", "let", "match", "member", "module", "mutable", "namespace", "new", "not", "null", "of", "open", "or", "override", "private", "public", "rec", "return", "select", "static", "struct", "then", "to", "true", "try", "type", "upcast", "use", "val", "void", "when", "while", "with", "yield"], slashComments: true, blocks: [["(*", "*)"]], nestedComments: true, tripleQuotes: true, lifetimes: true},
    ocaml: { apostropheIdentifiers: true,keywords: ["and", "as", "assert", "asr", "begin", "class", "constraint", "do", "done", "downto", "else", "end", "exception", "external", "false", "for", "fun", "function", "functor", "if", "in", "include", "inherit", "initializer", "land", "lazy", "let", "lor", "lsl", "lsr", "lxor", "match", "method", "mod", "module", "mutable", "new", "nonrec", "object", "of", "open", "or", "private", "rec", "sig", "struct", "then", "to", "true", "try", "type", "val", "virtual", "when", "while", "with"], blocks: [["(*", "*)"]], nestedComments: true, lifetimes: true},
    clojure: {keywords: ["and", "as", "as->", "binding", "case", "catch", "comment", "cond", "cond->", "cond->>", "condp", "def", "defmacro", "defmethod", "defmulti", "defn", "defn-", "defonce", "defprotocol", "defrecord", "deftype", "do", "doseq", "dotimes", "doto", "else", "extend", "extend-protocol", "extend-type", "finally", "fn", "for", "if", "if-let", "if-not", "if-some", "import", "in-ns", "let", "letfn", "loop", "macroexpand", "new", "ns", "or", "quote", "recur", "refer-clojure", "reify", "require", "set!", "some->", "some->>", "throw", "time", "try", "var", "when", "when-first", "when-let", "when-not", "while", "with-open"], lineComments: [";"], singleQuotes: false, symbols: true, hyphenated: true, literals: ["true", "false", "nil"]},
    lisp: {keywords: ["and", "block", "case", "catch", "cond", "defclass", "defconstant", "defgeneric", "define-condition", "defmacro", "defmethod", "defpackage", "defparameter", "defstruct", "defun", "defvar", "do", "do*", "dolist", "dotimes", "ecase", "eval-when", "flet", "function", "go", "if", "labels", "lambda", "let", "let*", "load-time-value", "locally", "loop", "macrolet", "multiple-value-bind", "multiple-value-call", "or", "progn", "progv", "quote", "return", "return-from", "setf", "setq", "tagbody", "the", "throw", "typecase", "unless", "unwind-protect", "when"], lineComments: [";"], blocks: [["#|", "|#"]], nestedComments: true, singleQuotes: false, caseInsensitive: true, hyphenated: true, symbols: true, literals: ["nil", "t"]},
    scheme: {keywords: ["and", "begin", "case", "cond", "define", "define-record-type", "define-syntax", "delay", "do", "else", "guard", "if", "import", "lambda", "let", "let*", "let-values", "letrec", "or", "parameterize", "quasiquote", "quote", "set!", "syntax-rules", "unless", "unquote", "when"], lineComments: [";"], blocks: [["#|", "|#"]], nestedComments: true, singleQuotes: false, hyphenated: true, symbols: true},
    racket: {keywords: ["and", "begin", "begin0", "case", "class", "cond", "define", "define-contract", "define-for-syntax", "define-syntax", "define-syntax-rule", "delay", "do", "else", "for", "for*", "for/list", "for/fold", "if", "lambda", "let", "let*", "letrec", "match", "module", "module+", "module*", "or", "parameterize", "provide", "quasiquote", "quote", "require", "set!", "struct", "syntax", "unless", "unquote", "when", "with-handlers"], lineComments: [";"], blocks: [["#|", "|#"]], nestedComments: true, singleQuotes: false, hyphenated: true, symbols: true},
    nim: {keywords: ["addr", "and", "as", "asm", "bind", "block", "break", "case", "cast", "concept", "const", "continue", "converter", "defer", "discard", "distinct", "div", "do", "elif", "else", "end", "enum", "except", "export", "finally", "for", "from", "func", "generic", "if", "import", "in", "include", "interface", "is", "isnot", "iterator", "let", "macro", "method", "mixin", "mod", "nil", "not", "notin", "object", "of", "or", "out", "proc", "ptr", "raise", "ref", "return", "shl", "shr", "static", "template", "try", "tuple", "type", "using", "var", "when", "while", "with", "without", "xor", "yield"], hashComments: true, blocks: [["#[", "]#"]], nestedComments: true, tripleQuotes: true, literals: ["true", "false", "nil"]},
    crystal: {keywords: ["abstract", "alias", "annotation", "as", "asm", "begin", "break", "case", "class", "def", "do", "else", "elsif", "end", "ensure", "enum", "extend", "for", "fun", "if", "in", "include", "instance_sizeof", "is_a", "lib", "macro", "module", "next", "nil", "of", "out", "pointerof", "private", "protected", "require", "rescue", "responds_to", "return", "select", "self", "sizeof", "struct", "super", "then", "typeof", "uninitialized", "union", "unless", "until", "verbatim", "when", "while", "with", "yield"], hashComments: true, tripleQuotes: true, heredoc: true, literals: ["true", "false", "nil"]},
    pascal: {keywords: ["and", "array", "as", "asm", "begin", "case", "class", "const", "constructor", "destructor", "div", "do", "downto", "else", "end", "except", "exports", "file", "finalization", "finally", "for", "function", "goto", "if", "implementation", "in", "inherited", "initialization", "inline", "interface", "is", "label", "library", "mod", "nil", "not", "object", "of", "on", "operator", "or", "out", "packed", "procedure", "program", "property", "raise", "record", "repeat", "resourcestring", "set", "shl", "shr", "string", "then", "threadvar", "to", "try", "type", "unit", "until", "uses", "var", "while", "with", "xor"], slashComments: true, blocks: [["(*", "*)"], ["{", "}"]], caseInsensitive: true, doubledQuotes: true},
    fortran: {keywords: ["abstract", "allocatable", "allocate", "assignment", "associate", "asynchronous", "backspace", "bind", "block", "call", "case", "character", "class", "close", "codimension", "common", "complex", "contains", "continue", "cycle", "data", "deallocate", "deferred", "dimension", "do", "double", "elemental", "else", "elseif", "elsewhere", "end", "enddo", "endif", "entry", "enum", "equivalence", "error", "exit", "external", "final", "flush", "forall", "format", "function", "generic", "goto", "if", "implicit", "import", "impure", "in", "include", "inquire", "integer", "intent", "interface", "intrinsic", "logical", "module", "namelist", "non_intrinsic", "non_overridable", "nopass", "nullify", "only", "open", "operator", "optional", "out", "parameter", "pass", "pause", "pointer", "precision", "print", "private", "procedure", "program", "protected", "public", "pure", "read", "real", "recursive", "result", "return", "rewind", "save", "select", "sequence", "stop", "submodule", "subroutine", "target", "then", "type", "use", "value", "volatile", "wait", "where", "while", "write"], lineComments: ["!"], caseInsensitive: true, doubledQuotes: true, literals: ["true", "false"]},
    cobol: {keywords: ["accept", "access", "add", "advancing", "after", "all", "alphabet", "also", "alter", "alternate", "and", "any", "are", "area", "areas", "ascending", "assign", "at", "author", "before", "binary", "blank", "block", "by", "call", "cancel", "cd", "cf", "ch", "character", "clock-units", "close", "cobol", "code", "code-set", "collating", "column", "com-reg", "comma", "common", "communication", "comp", "compute", "configuration", "contains", "content", "continue", "control", "controls", "converting", "copy", "corr", "corresponding", "count", "currency", "data", "date", "date-written", "day", "db", "de", "debug-contents", "debug-item", "debug-line", "debug-name", "debug-sub-1", "debug-sub-2", "debug-sub-3", "debugging", "decimal-point", "declaratives", "delete", "delimited", "delimiter", "depending", "descending", "destination", "detail", "disable", "display", "divide", "division", "down", "duplicates", "dynamic", "egcs", "else", "emi", "enable", "end", "end-add", "end-call", "end-compute", "end-delete", "end-divide", "end-evaluate", "end-if", "end-multiply", "end-perform", "end-read", "end-return", "end-rewrite", "end-search", "end-start", "end-string", "end-subtract", "end-unstring", "end-write", "end-of-page", "enter", "environment", "eop", "equal", "error", "evaluate", "every", "exception", "exit", "extend", "external", "false", "fd", "file", "file-control", "filler", "final", "first", "footing", "for", "from", "giving", "global", "greater", "group", "heading", "high-value", "identification", "if", "in", "index", "indexed", "indicate", "initial", "initialize", "initiate", "input", "input-output", "inspect", "install", "into", "invalid", "is", "just", "justified", "key", "label", "last", "leading", "left", "length", "less", "limit", "limits", "linage", "line", "lines", "linkage", "lock", "memory", "merge", "message", "mode", "modules", "move", "multiple", "multiply", "native", "negative", "next", "no", "not", "number", "numeric", "object-computer", "occurs", "of", "off", "omitted", "on", "open", "optional", "or", "order", "organization", "other", "output", "overflow", "packed-decimal", "padding", "page", "perform", "pf", "ph", "pic", "picture", "plus", "pointer", "position", "positive", "printing", "procedure", "procedures", "proceed", "process", "processing", "program", "program-id", "purge", "queue", "quote", "random", "rd", "read", "receive", "record", "recording", "records", "redefines", "reel", "reference", "references", "relative", "release", "remainder", "removal", "renames", "replace", "replacing", "report", "reporting", "reports", "rerun", "reserve", "reset", "return", "returning", "reversed", "rewind", "rewrite", "rf", "rh", "right", "rounded", "run", "same", "sd", "search", "section", "security", "segment", "segment-limit", "select", "send", "sentence", "separate", "sequence", "sequential", "set", "sign", "size", "sort", "sort-merge", "source", "source-computer", "space", "special-names", "standard", "standard-1", "standard-2", "start", "status", "stop", "string", "sub-queue-1", "sub-queue-2", "sub-queue-3", "subtract", "sum", "suppress", "symbolic", "sync", "synchronized", "table", "tally", "tallying", "tape", "terminal", "terminate", "test", "text", "than", "then", "through", "thru", "time", "times", "to", "top", "trailing", "true", "type", "unit", "unstring", "until", "up", "upon", "usage", "use", "using", "value", "values", "varying", "when", "with", "words", "working-storage", "write", "zero"], lineComments: ["*>"], caseInsensitive: true, hyphenated: true, doubledQuotes: true},
    vbnet: {keywords: ["addhandler", "addressof", "alias", "and", "andalso", "as", "async", "await", "boolean", "byref", "byte", "byval", "call", "case", "catch", "cbool", "cbyte", "cchar", "cdate", "cdec", "cdbl", "char", "cint", "class", "clng", "cobj", "const", "continue", "csbyte", "cshort", "csng", "cstr", "ctype", "cuint", "culng", "cushort", "date", "decimal", "declare", "default", "delegate", "dim", "directcast", "do", "double", "each", "else", "elseif", "end", "enum", "erase", "error", "event", "exit", "false", "finally", "for", "friend", "function", "get", "gettype", "getxmlnamespace", "global", "gosub", "goto", "handles", "if", "implements", "imports", "in", "inherits", "integer", "interface", "is", "isnot", "let", "lib", "like", "long", "loop", "me", "mod", "module", "mustinherit", "mustoverride", "mybase", "myclass", "namespace", "narrowing", "new", "next", "not", "nothing", "notinheritable", "notoverridable", "object", "of", "on", "operator", "option", "optional", "or", "orelse", "out", "overloads", "overridable", "overrides", "paramarray", "partial", "private", "property", "protected", "public", "raiseevent", "readonly", "redim", "rem", "removehandler", "resume", "return", "sbyte", "select", "set", "shadows", "shared", "short", "single", "static", "step", "stop", "string", "structure", "sub", "synclock", "then", "throw", "to", "true", "try", "trycast", "typeof", "uinteger", "ulong", "ushort", "using", "variant", "wend", "when", "while", "widening", "with", "withevents", "writeonly", "xor", "yield"], lineComments: ["'"], caseInsensitive: true, singleQuotes: false, doubledQuotes: true, preprocessor: true},
    ada: {keywords: ["abort", "abs", "abstract", "accept", "access", "aliased", "all", "and", "array", "at", "begin", "body", "case", "constant", "declare", "delay", "delta", "digits", "do", "else", "elsif", "end", "entry", "exception", "exit", "for", "function", "generic", "goto", "if", "in", "interface", "is", "limited", "loop", "mod", "new", "not", "null", "of", "or", "others", "out", "overriding", "package", "parallel", "pragma", "private", "procedure", "protected", "raise", "range", "record", "rem", "renames", "requeue", "return", "reverse", "select", "separate", "some", "subtype", "synchronized", "tagged", "task", "terminate", "then", "type", "until", "use", "when", "while", "with", "xor"], dashComments: true, caseInsensitive: true, doubledQuotes: true, lifetimes: true},
    solidity: {keywords: ["abstract", "address", "anonymous", "as", "assembly", "bool", "break", "bytes", "calldata", "catch", "constant", "constructor", "continue", "contract", "delete", "do", "else", "emit", "enum", "error", "event", "external", "fallback", "fixed", "for", "from", "function", "if", "immutable", "import", "indexed", "interface", "internal", "is", "library", "mapping", "memory", "modifier", "new", "override", "payable", "pragma", "private", "public", "pure", "receive", "return", "returns", "storage", "string", "struct", "super", "this", "throw", "try", "type", "ufixed", "unchecked", "using", "var", "view", "virtual", "while"], slashComments: true},
    verilog: {keywords: ["always", "and", "assign", "automatic", "begin", "buf", "bufif0", "bufif1", "case", "casex", "casez", "cell", "cmos", "config", "deassign", "default", "defparam", "design", "disable", "edge", "else", "end", "endcase", "endconfig", "endfunction", "endgenerate", "endmodule", "endprimitive", "endspecify", "endtable", "endtask", "event", "for", "force", "forever", "fork", "function", "generate", "genvar", "highz0", "highz1", "if", "ifnone", "incdir", "include", "initial", "inout", "input", "instance", "integer", "join", "large", "liblist", "library", "localparam", "macromodule", "medium", "module", "nand", "negedge", "nmos", "nor", "noshowcancelled", "not", "notif0", "notif1", "or", "output", "parameter", "pmos", "posedge", "primitive", "pull0", "pull1", "pulldown", "pullup", "pulsestyle_onevent", "pulsestyle_ondetect", "rcmos", "real", "realtime", "reg", "release", "repeat", "rnmos", "rpmos", "rtran", "rtranif0", "rtranif1", "scalared", "showcancelled", "signed", "small", "specify", "specparam", "strong0", "strong1", "supply0", "supply1", "table", "task", "time", "tran", "tranif0", "tranif1", "tri", "tri0", "tri1", "triand", "trior", "trireg", "unsigned", "use", "vectored", "wait", "wand", "weak0", "weak1", "while", "wire", "wor", "xnor", "xor"], slashComments: true},
    systemverilog: {keywords: ["always", "and", "assign", "automatic", "begin", "buf", "bufif0", "bufif1", "case", "casex", "casez", "cell", "cmos", "config", "deassign", "default", "defparam", "design", "disable", "edge", "else", "end", "endcase", "endconfig", "endfunction", "endgenerate", "endmodule", "endprimitive", "endspecify", "endtable", "endtask", "event", "for", "force", "forever", "fork", "function", "generate", "genvar", "highz0", "highz1", "if", "ifnone", "incdir", "include", "initial", "inout", "input", "instance", "integer", "join", "large", "liblist", "library", "localparam", "macromodule", "medium", "module", "nand", "negedge", "nmos", "nor", "noshowcancelled", "not", "notif0", "notif1", "or", "output", "parameter", "pmos", "posedge", "primitive", "pull0", "pull1", "pulldown", "pullup", "pulsestyle_onevent", "pulsestyle_ondetect", "rcmos", "real", "realtime", "reg", "release", "repeat", "rnmos", "rpmos", "rtran", "rtranif0", "rtranif1", "scalared", "showcancelled", "signed", "small", "specify", "specparam", "strong0", "strong1", "supply0", "supply1", "table", "task", "time", "tran", "tranif0", "tranif1", "tri", "tri0", "tri1", "triand", "trior", "trireg", "unsigned", "use", "vectored", "wait", "wand", "weak0", "weak1", "while", "wire", "wor", "xnor", "xor", "accept_on", "alias", "always_comb", "always_ff", "always_latch", "assert", "assume", "before", "bind", "bins", "binsof", "bit", "break", "byte", "chandle", "checker", "class", "clocking", "const", "constraint", "context", "continue", "cover", "covergroup", "coverpoint", "cross", "dist", "do", "endchecker", "endclass", "endclocking", "endgroup", "endinterface", "endpackage", "endprogram", "endproperty", "endsequence", "enum", "expect", "export", "extends", "extern", "final", "first_match", "foreach", "forkjoin", "iff", "ignore_bins", "illegal_bins", "implements", "implies", "import", "inside", "int", "interconnect", "interface", "intersect", "join_any", "join_none", "let", "local", "logic", "longint", "matches", "modport", "nettype", "new", "null", "package", "packed", "priority", "program", "property", "protected", "pure", "rand", "randc", "randcase", "randsequence", "ref", "return", "sequence", "shortint", "shortreal", "solve", "static", "string", "struct", "super", "sync_accept_on", "sync_reject_on", "tagged", "this", "throughout", "timeprecision", "timeunit", "type", "typedef", "union", "unique", "unique0", "var", "virtual", "void", "wait_order", "wildcard", "with", "within"], slashComments: true},
    vhdl: {keywords: ["abs", "access", "after", "alias", "all", "and", "architecture", "array", "assert", "assume", "attribute", "begin", "block", "body", "buffer", "bus", "case", "component", "configuration", "constant", "context", "cover", "default", "disconnect", "downto", "else", "elsif", "end", "entity", "exit", "fair", "file", "for", "force", "function", "generate", "generic", "group", "guarded", "if", "impure", "in", "inertial", "inout", "is", "label", "library", "linkage", "literal", "loop", "map", "mod", "nand", "new", "next", "nor", "not", "null", "of", "on", "open", "or", "others", "out", "package", "parameter", "port", "postponed", "procedure", "process", "property", "protected", "pure", "range", "record", "register", "reject", "release", "rem", "report", "restrict", "return", "rol", "ror", "select", "sequence", "severity", "shared", "signal", "sla", "sll", "sra", "srl", "strong", "subtype", "then", "to", "transport", "type", "unaffected", "units", "until", "use", "variable", "vmode", "vprop", "vunit", "wait", "when", "while", "with", "xnor", "xor"], dashComments: true, caseInsensitive: true, doubledQuotes: true, lifetimes: true},
    glsl: {keywords: ["attribute", "bool", "break", "buffer", "bvec2", "bvec3", "bvec4", "case", "centroid", "coherent", "const", "continue", "default", "discard", "dmat2", "dmat3", "dmat4", "do", "double", "dvec2", "dvec3", "dvec4", "else", "flat", "float", "for", "highp", "if", "in", "inout", "int", "invariant", "ivec2", "ivec3", "ivec4", "layout", "lowp", "mat2", "mat3", "mat4", "mediump", "noperspective", "out", "patch", "precision", "readonly", "restrict", "return", "sampler2D", "samplerCube", "shared", "smooth", "struct", "subroutine", "switch", "uint", "uniform", "uvec2", "uvec3", "uvec4", "varying", "vec2", "vec3", "vec4", "void", "volatile", "while", "writeonly"], slashComments: true, preprocessor: true},
    hlsl: {keywords: ["asm", "bool", "break", "Buffer", "ByteAddressBuffer", "case", "cbuffer", "centroid", "class", "column_major", "compile", "const", "continue", "default", "discard", "do", "double", "else", "export", "extern", "false", "float", "float2", "float3", "float4", "float4x4", "for", "groupshared", "half", "if", "in", "inline", "inout", "int", "interface", "line", "lineadj", "linear", "matrix", "namespace", "nointerpolation", "noperspective", "out", "packoffset", "pass", "precise", "RasterizerOrderedBuffer", "register", "return", "row_major", "RWBuffer", "RWByteAddressBuffer", "RWStructuredBuffer", "RWTexture2D", "sample", "sampler", "sampler_state", "SamplerState", "shared", "snorm", "stateblock", "static", "string", "struct", "StructuredBuffer", "switch", "tbuffer", "technique", "technique10", "technique11", "texture", "Texture2D", "Texture3D", "TextureCube", "true", "typedef", "uint", "uniform", "unorm", "unsigned", "vector", "vertexfragment", "void", "volatile", "while"], slashComments: true, preprocessor: true},
    wgsl: {keywords: ["alias", "array", "atomic", "bitcast", "bool", "break", "case", "const", "const_assert", "continue", "continuing", "default", "diagnostic", "discard", "else", "enable", "f16", "f32", "false", "fn", "for", "i32", "if", "let", "loop", "mat2x2", "mat3x3", "mat4x4", "override", "ptr", "requires", "return", "sampler", "sampler_comparison", "struct", "switch", "texture_2d", "texture_3d", "texture_cube", "true", "u32", "var", "vec2", "vec3", "vec4", "while"], slashComments: true, nestedComments: true, annotations: true},
    graphql: {keywords: ["query", "mutation", "subscription", "fragment", "on", "schema", "scalar", "type", "interface", "union", "enum", "input", "extend", "directive", "implements", "repeatable"], hashComments: true, tripleQuotes: true, dollarVariables: true},
    protobuf: {keywords: ["syntax", "edition", "import", "weak", "public", "package", "option", "optional", "required", "repeated", "oneof", "map", "reserved", "extensions", "to", "max", "message", "enum", "service", "rpc", "stream", "returns", "group", "extend"], slashComments: true},
    toml: {keywords: [], hashComments: true, tripleQuotes: true, properties: true, doubledQuotes: false, multilineQuotes: true, literals: ["true", "false", "inf", "nan"]},
    ini: {keywords: [], hashComments: true, lineComments: [";"], properties: true, multilineQuotes: true},
    dockerfile: {keywords: ["add", "arg", "cmd", "copy", "entrypoint", "env", "expose", "from", "healthcheck", "label", "maintainer", "onbuild", "run", "shell", "stopsignal", "user", "volume", "workdir", "as"], hashComments: true, caseInsensitive: true, dollarVariables: true, hyphenated: true},
    makefile: {keywords: ["define", "endef", "undefine", "ifdef", "ifndef", "ifeq", "ifneq", "else", "endif", "include", "sinclude", "override", "export", "unexport", "private", "vpath"], hashComments: true, dollarVariables: true, properties: true, hyphenated: true},
    cmake: {keywords: ["block", "break", "cmake_minimum_required", "continue", "else", "elseif", "enable_language", "endblock", "endforeach", "endfunction", "endif", "endmacro", "endwhile", "foreach", "function", "if", "include", "macro", "message", "option", "project", "return", "set", "unset", "while", "add_executable", "add_library", "target_link_libraries", "target_include_directories", "target_compile_features", "find_package"], hashComments: true, caseInsensitive: true, dollarVariables: true},
    nginx: {keywords: ["server", "location", "http", "events", "upstream", "stream", "map", "geo", "if", "else", "include", "listen", "server_name", "root", "index", "return", "rewrite", "proxy_pass", "try_files", "access_log", "error_log", "set"], hashComments: true, dollarVariables: true, hyphenated: true},
    hcl: {keywords: ["variable", "output", "resource", "data", "provider", "terraform", "module", "locals", "required_providers", "backend", "dynamic", "for", "in", "if"], slashComments: true, hashComments: true, properties: true, hyphenated: true, multilineQuotes: true},
    markdown: {keywords: []},
    diff: {keywords: []},
    assembly: {keywords: ["add", "and", "call", "cmp", "db", "dd", "dec", "dq", "dw", "extern", "global", "inc", "int", "je", "jg", "jge", "jl", "jle", "jmp", "jne", "lea", "loop", "mov", "movabs", "movq", "movl", "nop", "not", "or", "pop", "push", "ret", "section", "shl", "shr", "sub", "syscall", "test", "xor"], lineComments: [";"], hashComments: true, caseInsensitive: true, percentVariables: true, properties: true},
    v: {keywords: ["as", "asm", "assert", "atomic", "break", "const", "continue", "defer", "else", "enum", "extern", "false", "fn", "for", "go", "goto", "if", "import", "in", "interface", "is", "isreftype", "lock", "match", "module", "mut", "none", "offsetof", "or", "pub", "return", "rlock", "select", "shared", "sizeof", "spawn", "static", "struct", "true", "type", "typeof", "union", "unsafe", "volatile", "__global"], slashComments: true, backticks: true, rawBackticks: true, literals: ["true", "false", "none"]},
    odin: {keywords: ["asm", "auto_cast", "bit_field", "bit_set", "break", "case", "cast", "context", "continue", "defer", "distinct", "do", "dynamic", "else", "enum", "fallthrough", "for", "foreign", "if", "import", "in", "map", "matrix", "nil", "no_inline", "or_else", "or_return", "package", "proc", "relative", "return", "struct", "switch", "transmute", "typeid", "union", "using", "when", "where"], slashComments: true, nestedComments: true, literals: ["true", "false", "nil"]},
    gdscript: {keywords: ["and", "as", "assert", "await", "break", "breakpoint", "class", "class_name", "const", "continue", "elif", "else", "enum", "extends", "for", "func", "if", "in", "is", "match", "not", "or", "pass", "preload", "return", "self", "signal", "static", "super", "var", "void", "while"], hashComments: true, tripleQuotes: true, annotations: true, literals: ["true", "false", "null", "PI", "TAU", "INF", "NAN"]},
    gml: {keywords: ["and", "as", "begin", "break", "case", "catch", "constructor", "continue", "default", "delete", "div", "do", "else", "end", "enum", "exit", "finally", "for", "function", "globalvar", "if", "in", "mod", "new", "not", "or", "repeat", "return", "static", "struct", "switch", "throw", "try", "until", "var", "while", "with", "xor"], slashComments: true},
  };
  for (const profile of Object.values(profiles)) {
    profile.keywords = new Set(profile.keywords);
    profile.blocks ||= profile.slashComments || profile.blockComments ? [["/*", "*/"]] : [];
    profile.lineComments ||= [];
  }
  // prettier-ignore
  const aliases = {"js": "javascript", "mjs": "javascript", "cjs": "javascript", "ts": "typescript", "htm": "html", "svg": "xml", "xhtml": "xml", "yml": "yaml", "py": "python", "pyw": "python", "sh": "bash", "shell": "bash", "zsh": "bash", "text": "plain", "txt": "plain", "plaintext": "plain", "c++": "cpp", "cc": "cpp", "cxx": "cpp", "hpp": "cpp", "h": "c", "c#": "csharp", "cs": "csharp", "kt": "kotlin", "kts": "kotlin", "sc": "scala", "objc": "objectivec", "objective-c": "objectivec", "m": "objectivec", "rs": "rust", "golang": "go", "rb": "ruby", "pl": "perl", "pm": "perl", "jl": "julia", "ps1": "powershell", "psm1": "powershell", "pwsh": "powershell", "bat": "batch", "cmd": "batch", "hs": "haskell", "ex": "elixir", "exs": "elixir", "erl": "erlang", "hrl": "erlang", "f#": "fsharp", "fs": "fsharp", "fsx": "fsharp", "ml": "ocaml", "mli": "ocaml", "clj": "clojure", "cljs": "clojure", "cljc": "clojure", "edn": "clojure", "commonlisp": "lisp", "common-lisp": "lisp", "cl": "lisp", "scm": "scheme", "ss": "scheme", "rkt": "racket", "nims": "nim", "cr": "crystal", "pas": "pascal", "pp": "pascal", "f": "fortran", "f90": "fortran", "f95": "fortran", "cob": "cobol", "cpy": "cobol", "vb": "vbnet", "visualbasic": "vbnet", "ada95": "ada", "ads": "ada", "adb": "ada", "sol": "solidity", "sv": "systemverilog", "svh": "systemverilog", "vhd": "vhdl", "vert": "glsl", "frag": "glsl", "shader": "hlsl", "gql": "graphql", "proto": "protobuf", "properties": "ini", "cfg": "ini", "conf": "ini", "docker": "dockerfile", "make": "makefile", "mk": "makefile", "cmake.in": "cmake", "terraform": "hcl", "tf": "hcl", "md": "markdown", "mdown": "markdown", "patch": "diff", "asm": "assembly", "nasm": "assembly", "vlang": "v", "gd": "gdscript", "gamemaker": "gml"};
  byCODEviewer.languages = Object.freeze(["html", "xml", ...Object.keys(profiles), "plain"]);

  // --- STATE ---
  const instances = new WeakMap();
  // --- HELPERS ---
  const node = (tag, className = "", text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  };
  // Yield at a chunk boundary so input events and replacement renders can run.
  const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

  // --- APPEARANCE ---
  const extraPalettes = new Set([
    "dracula",
    "darcula",
    "nord",
    "catppuccin",
    "catppuccin-frappe",
    "catppuccin-macchiato",
    "rose-pine",
    "rose-pine-moon",
    "gruvbox",
    "gruvbox-material",
    "tokyo-night",
    "tokyo-storm",
    "tokyo-moon",
    "one",
    "material",
    "material-ocean",
    "night-owl",
    "synthwave",
    "ayu",
    "everforest",
    "kanagawa",
    "selenized",
    "vscode",
    "monokai-dimmed",
    "discord",
    "slack",
    "bonyur",
    "sakura",
    "bubblegum",
    "candy",
    "rose-gold",
    "lavender",
    "cyberpunk",
    "sunset",
    "volcano",
    "amber",
    "terminal",
    "paper",
    "ink",
    "ocean",
    "forest",
    "mint",
    "ice",
    "sepia"
  ]);
  const warnedPalettes = new Set();
  const warnMissingThemes = (element, palette = element.dataset.theme) => {
    if (!extraPalettes.has(palette) || warnedPalettes.has(palette)) return;
    const document = element.ownerDocument;
    if (document.defaultView.getComputedStyle(document.documentElement).getPropertyValue("--by-code-themes-loaded").trim() === "1") return;
    warnedPalettes.add(palette);
    // console.warn(`easy-code-viewer: Palette "${palette}" requires code.themes.css. Import it after code.css. https://byuwur.github.io/easy-code-viewer/`);
    console.warn(`easy-code-viewer: Palette "${palette}" requires code.themes.css. Import it after code.css. https://code.byuwur.co/`);
  };

  // Explicit appearance options override markup; omitted values preserve the container's state.
  const applyAppearance = (element, options) => {
    const { theme, palette, fontSize } = options;
    if (theme != null && !["light", "dark"].includes(theme)) throw new RangeError("Theme must be light or dark.");
    if (palette != null && (typeof palette !== "string" || !/^[a-z][\w-]*$/i.test(palette) || ["light", "dark"].includes(palette))) throw new RangeError("Palette must be a CSS theme name; use theme for light or dark.");
    warnMissingThemes(element, palette ?? element.dataset.theme);
    const size = typeof fontSize === "number" ? `${Math.max(0.5, Math.min(3, fontSize))}rem` : typeof fontSize === "string" ? `clamp(0.5rem, ${fontSize}, 3rem)` : "";
    if (fontSize != null && (typeof fontSize === "number" ? !Number.isFinite(fontSize) : typeof fontSize !== "string" || !CSS.supports("font-size", size))) throw new RangeError("Font size must be a finite multiplier or a CSS size.");
    // Keep palette identity in data-theme while light/dark classes select its mode.
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

  // --- CONTROLS ---
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
    // Remember the caller's initial size so Reset also works after this toolbar is recreated.
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

  // --- PARSING ---
  // Resolve supported aliases; unknown names deliberately fall back to uncolored source.
  const languageName = (value) => {
    const name = String(value ?? "plain")
      .trim()
      .toLowerCase();
    return Object.hasOwn(aliases, name) ? aliases[name] : byCODEviewer.languages.includes(name) ? name : "plain";
  };
  const token = (type, text) => ({ type, text });
  // Quotes own comment markers and escaped delimiters until the matching language-specific close.
  const quotedEnd = (source, start, end, language) => {
    const profile = profiles[language] || {},
      quote = source[start];
    const triple = profile.tripleQuotes && source.startsWith(quote.repeat(3), start);
    const delimiter = triple ? quote.repeat(3) : quote;
    // Raw strings use their language's own terminator rules rather than backslash escaping.
    const raw = (triple && profile.rawTriple) || (quote === "`" && profile.rawBackticks) || (language === "toml" && quote === "'");
    let i = start + delimiter.length;
    for (; i < end; i++) {
      if (source[i] === "\\" && !raw && language !== "html" && language !== "powershell" && !(language === "yaml" && quote === "'") && !(language === "bash" && quote === "'")) {
        i++;
        continue;
      }
      if (language === "powershell" && source[i] === "`") {
        i++;
        continue;
      }
      if (source.startsWith(delimiter, i)) {
        if (!triple && (profile.doubledQuotes || ["sql", "yaml"].includes(language)) && source[i + 1] === quote) {
          i++;
          continue;
        }
        return i + delimiter.length;
      }
      if (!triple && source[i] === "\n" && !profile.multilineQuotes && !["yaml", "php", "bash", "sql", "html"].includes(language)) return i;
    }
    return end;
  };
  const lineEnd = (source, start, end) => {
    const i = source.indexOf("\n", start);
    return i < 0 ? end : Math.min(i, end);
  };

  // Tokenization consumes original slices once; strings/comments own their contents before keyword matching.
  // Yield original source slices while carrying lexical context across lines and nested templates.
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
              if ((here.indent ? line.trimStart() : here.tabs ? line.replace(/^\t+/, "") : line) === here.label) break;
            }
            yield token("string", source.slice(from, i));
          }
          pendingHeredoc = [];
          continue;
        }
        i++;
        while (i < end && /\s/.test(source[i]) && !(pendingHeredoc.length && source[i] === "\n")) i++;
      } else if (language === "lua" && (source.startsWith("--[", i) || char === "[") && /^(?:--)?\[=*\[/.test(source.slice(i))) {
        const opening = source.slice(i).match(/^(--)?\[(=*)\[/),
          delimiter = `]${opening[2]}]`;
        type = opening[1] ? "comment" : "string";
        const close = source.indexOf(delimiter, i + opening[0].length);
        i = close < 0 ? end : Math.min(end, close + delimiter.length);
      } else if ((language === "rust" && /^(?:br|cr|r)#{0,255}"/.test(source.slice(i))) || (language === "swift" && char === "#" && /^#+"/.test(source.slice(i)))) {
        const opening = language === "rust" ? source.slice(i).match(/^(?:br|cr|r)(#*)"/) : source.slice(i).match(/^(#+)("{3}|"{1})/);
        const delimiter = (language === "swift" ? opening[2] : '"') + opening[1];
        type = "string";
        const close = source.indexOf(delimiter, i + opening[0].length);
        i = close < 0 ? end : Math.min(end, close + delimiter.length);
      } else if (language === "cpp" && /^(?:u8|u|U|L)?R"[^\s()\\]{0,16}\(/.test(source.slice(i))) {
        const opening = source.slice(i).match(/^(?:u8|u|U|L)?R"([^\s()\\]{0,16})\(/),
          delimiter = `)${opening[1]}"`;
        type = "string";
        const close = source.indexOf(delimiter, i + opening[0].length);
        i = close < 0 ? end : Math.min(end, close + delimiter.length);
      } else if (language === "csharp" && /^(?:\$*@|@\$|\$*)"/.test(source.slice(i)) && (/^(?:\$*@|@\$)"/.test(source.slice(i)) || /^\$*"{3,}/.test(source.slice(i)))) {
        const opening = source.slice(i).match(/^(?:\$*@|@\$)"|^\$*("{3,})/);
        const delimiter = opening[1] || '"';
        type = "string";
        i += opening[0].length;
        while (i < end) {
          if (source.startsWith(delimiter, i)) {
            i += delimiter.length;
            if (delimiter.length === 1 && source[i] === '"') {
              i++;
              continue;
            }
            break;
          }
          i++;
        }
      } else if (language === "powershell" && char === "@" && /^@['"]\r?\n/.test(source.slice(i))) {
        const close = new RegExp(`^${source[i + 1]}@(?=\\r?$)`, "gm");
        close.lastIndex = i + 2;
        const match = close.exec(source);
        type = "string";
        i = match && match.index < end ? match.index + match[0].length : end;
      } else if (profile.blocks.some(([opening]) => source.startsWith(opening, i))) {
        const [opening, closing] = profile.blocks.find(([opening]) => source.startsWith(opening, i));
        type = "comment";
        i += opening.length;
        let nesting = 1;
        while (i < end && nesting) {
          if (profile.nestedComments && (language !== "d" || opening === "/+") && source.startsWith(opening, i)) {
            nesting++;
            i += opening.length;
          } else if (source.startsWith(closing, i)) {
            nesting--;
            i += closing.length;
          } else i++;
        }
      } else if (
        (profile.slashComments && char === "/" && next === "/") ||
        (profile.dashComments && char === "-" && next === "-") ||
        (profile.hashComments && char === "#" && (language === "php" ? next !== "[" : ["bash", "yaml"].includes(language) ? i === 0 || /[\s;|&(]/.test(source[i - 1]) : true)) ||
        profile.lineComments.some((opening) => source.startsWith(opening, i)) ||
        (profile.lineStartComments &&
          !source.slice(source.lastIndexOf("\n", i - 1) + 1, i).trim() &&
          profile.lineStartComments.some((opening) => source.slice(i, i + opening.length).toLowerCase() === opening && (opening === "::" || /\s|$/.test(source[i + opening.length] || ""))))
      ) {
        type = "comment";
        i = lineEnd(source, i, end);
        if (stop === "php") {
          const close = source.indexOf("?>", begin);
          if (close >= 0 && close < i) i = close;
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
      } else if ((language === "bash" || profile.heredoc) && source.startsWith("<<", i) && source[i + 2] !== "<") {
        const opening = source.slice(i).match(/^<<([-~]?)[ \t]*(['"]?)([A-Za-z_]\w*)\2/);
        if (opening) {
          type = "operator";
          i += opening[0].length;
          // Queue heredoc bodies until the opener's line ends; multiple declarations are consumed in order.
          pendingHeredoc.push({
            label: opening[3],
            tabs: opening[1] === "-",
            indent: Boolean(profile.heredoc)
          });
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
      } else if (profile.jsx && char === "<" && canRegex && depth < 32 && /^<(?:[A-Za-z][\w.:-]*(?=[\s/>])|>)/.test(source.slice(i))) {
        i = yield* jsxTokens(source, language, i, end, depth);
        canRegex = false;
        continue;
      } else if (["verilog", "systemverilog"].includes(language) && (char === "'" || /\d/.test(char)) && /^(?:\d[\d_]*)?'[sS]?[bBoOdDhH][\da-fA-F_xXzZ?]+|^'[01xXzZ]/.test(source.slice(i))) {
        type = "number";
        i += source.slice(i).match(/^(?:\d[\d_]*)?'[sS]?[bBoOdDhH][\da-fA-F_xXzZ?]+|^'[01xXzZ]/)[0].length;
      } else if (profile.lifetimes && char === "'" && /^'[A-Za-z_]\w*(?![\w'])/.test(source.slice(i)) && !/^'(?:[^'\\]|\\.)'/.test(source.slice(i))) {
        type = "variable";
        i += source.slice(i).match(/^'[A-Za-z_]\w*/)[0].length;
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
            i = yield* scriptTokens(source, language, i + 2, end, "brace", depth + 1);
            piece = i;
            continue;
          }
          i++;
        }
        if (i > piece) yield token("string", source.slice(piece, i));
        canRegex = false;
        continue;
      } else if (
        (char === '"' || (char === "'" && profile.singleQuotes !== false) || (char === "`" && (profile.backticks || ["php", "sql", "javascript", "typescript", "jsx", "tsx"].includes(language)))) &&
        (language !== "yaml" || i === 0 || /[\s:[{,?\-]/.test(source[i - 1]))
      ) {
        type = language === "sql" && char !== "'" ? "property" : "string";
        i = quotedEnd(source, i, end, language);
        if ((["json", "yaml"].includes(language) || profile.properties) && /^\s*[:=]/.test(source.slice(i))) type = "property";
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
      } else if (((["php", "bash"].includes(language) || profile.dollarVariables) && char === "$") || (language === "yaml" && /[&*!]/.test(char)) || (profile.atVariables && char === "@") || (profile.percentVariables && char === "%")) {
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
        } else while (i < end && /[\w!?@#*.:%-]/.test(source[i])) i++;
        canRegex = false;
      } else if (/\d/.test(char) || (char === "." && /\d/.test(next ?? ""))) {
        const match = source.slice(i).match(/^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?[\d_]+)?n?)/);
        i += match?.[0].length || 1;
        type = "number";
        canRegex = false;
        if (profile.css) while (i < end && /[A-Za-z%]/.test(source[i])) i++;
      } else if (profile.css && char === "#" && /^[\da-fA-F]{3,8}\b/.test(source.slice(i + 1))) {
        type = "number";
        i += 1 + source.slice(i + 1).match(/^[\da-fA-F]+/)[0].length;
      } else if (profile.css && char === "@") {
        type = "keyword";
        i++;
        while (i < end && /[\w-]/.test(source[i])) i++;
      } else if ((profile.preprocessor && char === "#") || (profile.annotations && char === "@") || (profile.symbols && char === ":" && /[A-Za-z_]/.test(next || ""))) {
        type = profile.symbols && char === ":" ? "literal" : "keyword";
        i++;
        while (i < end && /[\w.:-]/.test(source[i])) i++;
      } else if (language === "ini" && char === "[") {
        type = "property";
        const close = source.indexOf("]", i + 1);
        i = close < 0 ? lineEnd(source, i, end) : Math.min(end, close + 1);
      } else if (/[A-Za-z_$\u0080-\uFFFF]/.test(char)) {
        i++;
        const identifier = profile.css || profile.hyphenated || ["yaml", "bash"].includes(language) ? /[\w\u0080-\uFFFF-]/ : /[\w$\u0080-\uFFFF]/;
        while (i < end && (identifier.test(source[i]) || (profile.apostropheIdentifiers && source[i] === "'"))) i++;
        const text = source.slice(begin, i),
          lower = text.toLowerCase();
        const keyword = profile.caseInsensitive ? lower : text;
        if (profile.keywords.has(keyword)) type = "keyword";
        else if ((profile.literals || ["true", "false", "null", "undefined", "NaN", "Infinity"]).includes(profile.caseInsensitive ? lower : text)) type = "literal";
        else if ((language === "yaml" || profile.css || profile.properties) && /^\s*[:=]/.test(source.slice(i))) type = "property";
        else if (/^\s*\(/.test(source.slice(i))) type = "function";
        // Expression context distinguishes a regex opener from division without a full language parser.
        canRegex = ["return", "throw", "case", "delete", "typeof", "void", "new", "in", "of", "yield", "await", "else", "do"].includes(text);
      } else {
        type = /[{}[\]();,.:]/.test(char) ? "punctuation" : "operator";
        i++;
        if (char === "{") braces++;
        if (char === "}" && braces > 0) braces--;
        canRegex = !/[)\]}.]/.test(char);
      }
      // Always consume input, even when a language-specific branch cannot recognize the token.
      if (i <= begin) i = begin + 1;
      yield token(type, source.slice(begin, i));
    }
    return i;
  }

  // JSX text is markup; only braces re-enter the script scanner, with the same recursion bound as templates.
  function* jsxTokens(source, language, start, end, depth) {
    let i = start,
      nesting = 0;
    while (i < end) {
      const begin = i;
      if (source[i] === "{") {
        yield token("punctuation", "{");
        i = yield* scriptTokens(source, language, i + 1, end, "brace", depth + 1);
      } else if (source[i] === "<" && /^<\/?(?:[A-Za-z][\w.:-]*)?(?=[\s/>])/.test(source.slice(i))) {
        const opening = source.slice(i).match(/^<(\/?)([\w.:-]*)/);
        i += opening[0].length;
        yield token("tag", opening[0]);
        let selfClosing = false;
        while (i < end) {
          const from = i;
          if (source.startsWith("/>", i) || source[i] === ">") {
            selfClosing = source[i] === "/";
            i += selfClosing ? 2 : 1;
            yield token("tag", source.slice(from, i));
            break;
          }
          if (source[i] === "{") {
            yield token("punctuation", "{");
            i = yield* scriptTokens(source, language, i + 1, end, "brace", depth + 1);
          } else if (source[i] === '"' || source[i] === "'") {
            i = quotedEnd(source, i, end, "html");
            yield token("string", source.slice(from, i));
          } else if (/\s/.test(source[i])) {
            while (i < end && /\s/.test(source[i])) i++;
            yield token("plain", source.slice(from, i));
          } else if (source[i] === "=") {
            yield token("operator", source[i++]);
          } else {
            i++;
            while (i < end && !/[\s={}>'"/]/.test(source[i])) i++;
            yield token("attribute", source.slice(from, i));
          }
        }
        nesting += opening[1] ? -1 : selfClosing ? 0 : 1;
        if (nesting <= 0) return i;
      } else {
        i++;
        while (i < end && !/[<{]/.test(source[i])) i++;
        yield token("plain", source.slice(begin, i));
      }
    }
    return i;
  }

  function* textTokens(source, language) {
    let i = 0;
    while (i < source.length) {
      const begin = i,
        end = lineEnd(source, i, source.length);
      const line = source.slice(i, end);
      let type = "plain";
      if (language === "diff") {
        type = /^(?:@@|diff |index |---|\+\+\+)/.test(line) ? "keyword" : /^\+/.test(line) ? "string" : /^-/.test(line) ? "comment" : "plain";
      } else if (/^\s*(`{3,}|~{3,})/.test(line)) {
        const fence = line.match(/^\s*(`{3,}|~{3,})/)[1];
        i = end < source.length ? end + 1 : end;
        while (i < source.length) {
          const to = lineEnd(source, i, source.length),
            candidate = source.slice(i, to).trim();
          i = to < source.length ? to + 1 : to;
          if (candidate[0] === fence[0] && candidate.length >= fence.length && [...candidate].every((char) => char === fence[0])) break;
        }
        yield token("string", source.slice(begin, i));
        continue;
      } else if (/^\s{0,3}#{1,6}\s|^\s*(?:[-*+] |\d+[.)] |[-*_]{3,}\s*$)/.test(line)) type = "keyword";
      else if (/^\s*>/.test(line)) type = "comment";
      else {
        const parts = /`+[^`\n]*`+|!?\[[^\]\n]*\]\([^\n)]*\)|\*{1,3}[^*\n]+\*{1,3}|~~[^~\n]+~~/g;
        let position = i,
          match;
        while ((match = parts.exec(line))) {
          const from = begin + match.index;
          if (from > position) yield token("plain", source.slice(position, from));
          yield token(match[0][0] === "`" ? "string" : "property", match[0]);
          position = from + match[0].length;
        }
        if (position < end) yield token("plain", source.slice(position, end));
        if (end < source.length) yield token("plain", "\n");
        i = end < source.length ? end + 1 : end;
        continue;
      }
      i = end < source.length ? end + 1 : end;
      yield token(type, source.slice(begin, i));
    }
  }

  // Scan tags and raw script/style regions; embedded source keeps its original character positions.
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
  // Mask PHP regions while scanning the HTML host, then overlay their tokens at the same offsets.
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
  // --- RENDERING ---
  const appendToken = (parent, part, text = part.text) => {
    if (part.type === "plain") parent.appendChild(document.createTextNode(text));
    else parent.appendChild(node("span", `byCODEtoken byCODE${part.type}`, text));
  };

  const codeStatus = (source, language, count) => (!source.length ? "No source code." : `${language} \u00b7 ${count} ${count === 1 ? "line" : "lines"}`);

  // --- LIFECYCLE ---
  // One instance owns the container; replacement disposes its pending work first.
  // Replace the previous owner and return its cancellable state. Only the current owner may clear the host.
  const mount = (element, options, getText) => {
    if (!(element instanceof HTMLElement)) throw new TypeError("byCODEviewer: element must be an HTMLElement.");
    // Validate appearance before disposing the current instance, so invalid options leave it usable.
    applyAppearance(element, options);
    const painted = element.classList.contains("byVIEWready");
    instances.get(element)?.destroy();
    const state = { active: true };
    state.destroy = () => {
      if (!state.active) return;
      state.active = false;
      cancelAnimationFrame(state.motionFrame);
      // An old controller must not clear a replacement mounted on the same element.
      if (instances.get(element) === state) {
        instances.delete(element);
        element.replaceChildren();
        element.classList.remove("byCODEdocument", "byVIEWcompact", "byVIEWbottom", "byVIEWmotion", "byVIEWappear", "byVIEWready");
        element.removeAttribute("aria-busy");
      }
    };
    instances.set(element, state);
    element.replaceChildren();
    element.classList.add("byCODEdocument");
    element.classList.toggle("byVIEWmotion", options.animations !== false);
    element.classList.toggle("byVIEWappear", options.animations !== false && options.appearAnimation === true);
    if (painted) element.classList.add("byVIEWready");
    else {
      // Enable background transitions after the first paint without forcing layout.
      state.motionFrame = requestAnimationFrame(() => {
        state.motionFrame = requestAnimationFrame(() => {
          if (state.active) element.classList.add("byVIEWready");
        });
      });
    }
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

  // --- PUBLIC API ---
  // Yield original slices, including whitespace. Validation runs when the iterator is consumed.
  // Return a lazy token stream; input and resource-limit errors occur when iteration advances.
  byCODEviewer.tokenize = function* (source, language) {
    if (typeof source !== "string") throw new TypeError("Code source must be a string.");
    if (source.length > 2000000 || source.split("\n").length > 20000) throw new RangeError("Code exceeds 2 million characters or 20,000 lines.");
    const name = languageName(language);
    const iterator =
      name === "plain"
        ? [token("plain", source)]
        : name === "php"
          ? phpTokens(source)
          : ["html", "xml"].includes(name)
            ? markupTokens(source, name)
            : ["markdown", "diff"].includes(name)
              ? textTokens(source, name)
              : scriptTokens(source, name);
    let count = 0;
    for (const part of iterator) {
      if (++count > 100000) throw new RangeError("Code exceeds 100,000 lexical tokens.");
      if (part.text) yield part;
    }
  };

  // Stateful lexical highlighting; source is never interpreted as HTML or executed.
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
    if (options.languageSelect !== false) {
      for (const value of byCODEviewer.languages) {
        const option = node("option", "", value);
        option.value = value;
        selector.appendChild(option);
      }
      selector.value = language;
      actions.appendChild(selector);
    }
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
    // --- RENDERING ---
    const render = async () => {
      // A later language selection supersedes any render paused between token chunks.
      const version = ++generation;
      element.setAttribute("aria-busy", "true");
      try {
        await pause();
        if (!state.active || version !== generation) return false;
        // Build offscreen and publish only after the final cancellation check to avoid partial stale output.
        const fragment = document.createDocumentFragment();
        let line,
          text,
          lineNumber = 0,
          count = 0;
        const newLine = () => {
          line = node("div", "byCODEline");
          line.dataset.line = String(++lineNumber);
          // Keep visual line numbers out of source selection and assistive reading.
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

  // Optional code-block presentation preserves the fragment's exact source text.
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
  // --- EXPORT ---
  global.byCODEviewer = byCODEviewer;
  byCODEviewer.initialized = true;
})(typeof window !== "undefined" ? window : this);
