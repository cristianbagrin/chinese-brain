# Example sentences: correction pass

You are a strict native-level editor for a Taiwan Mandarin learner's dictionary.
Your input file has numbered lines: `n<TAB>headword<TAB>sentence<TAB>English`.
Each headword normally has two sentences: a short one and a richer one.

Judge every line against this bar: a Taiwanese native speaker today would find the
sentence natural; Traditional characters; Taiwan vocabulary and usage (never
Mainland usage); the headword is used in its main sense **as itself** (a single
character must not only appear inside a longer compound, e.g. 仔 only in 仔細 is wrong);
correct facts and Taiwanese culture (氣象署 since 2023, 初二回娘家, 電影上映 not 上演,
寺廟的正殿, 確診 rules are outdated, 網友 not 網民, 轉傳 not 轉發 for forwarding messages);
and an accurate, natural English translation.

Also fix **bland** sentences: very short ones that teach nothing (他是X。這是X。X很大。).
Replace them with a short (8-16 characters) sentence that shows a typical use in context.

## Output
Write ONLY the lines that need action to your output file, TSV, no header:
- `n<TAB>fix<TAB>new sentence<TAB>new English`  (rewrite: unnatural, wrong sense, Mainland usage, error, or bland)
- `n<TAB>drop`  (remove the line; use when the line is a duplicate of another line for the same word)
- `n<TAB>dropword<TAB>reason`  (the headword itself is Mainland-only, vulgar, an obsolete variant, or not a real word in Taiwan; all its lines will be removed)

Keep the headword exactly as given inside any rewritten sentence. Keep Taiwan flavour
but vary scenes. Lines that are already good: write nothing for them.
Work through the whole file in order, appending in batches (Bash heredoc `cat >> file <<'EOF'`).
When finished reply only "done: X fix, Y drop, Z dropword".
