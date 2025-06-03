pub fn strip_sql_comments(input: &str) -> String {
    enum State {
        Normal,
        InSingleQuote,      // inside '…'
        InDoubleQuote,      // inside "…"
        InBacktick,         // inside `…`
        InLineComment,      // after `--` or `#`, until end of line
        InBlockComment,     // after `/*`, until `*/`
    }

    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    let mut state = State::Normal;

    while let Some(ch) = chars.next() {
        match state {
            State::Normal => {
                match ch {
                    '\'' => {
                        // Enter single‐quote string
                        out.push(ch);
                        state = State::InSingleQuote;
                    }
                    '"' => {
                        // Enter double‐quote string
                        out.push(ch);
                        state = State::InDoubleQuote;
                    }
                    '`' => {
                        // Enter backtick‐quoted identifier
                        out.push(ch);
                        state = State::InBacktick;
                    }
                    '-' => {
                        // Could be start of `--` comment
                        if let Some('-') = chars.peek() {
                            // consume second '-'
                            chars.next();
                            state = State::InLineComment;
                        } else {
                            out.push(ch);
                        }
                    }
                    '#' => {
                        // Start of single‐line comment
                        state = State::InLineComment;
                    }
                    '/' => {
                        // Could be start of block comment `/*`
                        if let Some('*') = chars.peek() {
                            chars.next();
                            state = State::InBlockComment;
                        } else {
                            out.push(ch);
                        }
                    }
                    _ => {
                        out.push(ch);
                    }
                }
            }

            State::InSingleQuote => {
                out.push(ch);
                if ch == '\\' {
                    // escape next character (so we don't accidentally see ' as closing)
                    if let Some(next_ch) = chars.next() {
                        out.push(next_ch);
                    }
                } else if ch == '\'' {
                    // end of single‐quote string
                    state = State::Normal;
                }
            }

            State::InDoubleQuote => {
                out.push(ch);
                if ch == '\\' {
                    // escape next character
                    if let Some(next_ch) = chars.next() {
                        out.push(next_ch);
                    }
                } else if ch == '"' {
                    // end of double‐quote string
                    state = State::Normal;
                }
            }

            State::InBacktick => {
                out.push(ch);
                if ch == '`' {
                    // end of backtick‐quoted identifier
                    state = State::Normal;
                }
            }

            State::InLineComment => {
                // consume until newline (but preserve the newline, since it might separate statements)
                if ch == '\n' {
                    out.push('\n');
                    state = State::Normal;
                } else {
                    // drop this character (skipped)
                }
            }

            State::InBlockComment => {
                // look for closing `*/`
                if ch == '*' {
                    if let Some('/') = chars.peek() {
                        // consume closing '/'
                        chars.next();
                        state = State::Normal;
                    }
                }
                // otherwise drop everything inside block comment, including newlines.
            }
        }
    }

    out
}