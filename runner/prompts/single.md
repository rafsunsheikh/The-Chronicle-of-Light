Below is the full text of a short book or document.

Book: {{TITLE}}
{{AUTHOR_LINE}}

Produce exactly this structure in Markdown:

# {{TITLE}}

*A Chronicle of Light summary{{AUTHOR_SUFFIX}}*

## In one paragraph
A single tight paragraph: what this is, what it argues or tells, and who it is for.

## Core argument
The spine of the text in 3 to 6 paragraphs.

## Key themes
Three to eight themes, each a `### ` heading followed by a short paragraph.

## Chapter-by-chapter
A `- **<chapter or section name>**: ` bullet per chapter or major section,
one to three sentences each, in order. If the text has no such divisions,
replace this section with `## How it unfolds` and give a short narrative of
the progression instead.

## People, places and dates
A bullet list of the named people, places and dated events a reader of a
history timeline would want to look up, each with the page or section where
it appears if the text shows one. Omit if the text has none.

## Takeaways
Six to twelve concrete, self-contained bullets.

## Notable passages
The strongest verbatim quotations as `>` blockquotes. Omit if there are none.

--- BEGIN TEXT ---
{{CONTENT}}
--- END TEXT ---
