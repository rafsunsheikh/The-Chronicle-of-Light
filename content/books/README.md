# Hosted book texts

Full texts of books that are public domain or openly licensed, one folder per
book, as `content/books/<slug>/content.md`. A library entry under
`src/data/library/` points here through its `contentPath` field when `hosted`
is true. The validator refuses a hosted entry whose licence does not allow
redistribution.

Nothing is hosted yet. The reader page that renders these files is Phase 6 of
the roadmap (issue #12).
