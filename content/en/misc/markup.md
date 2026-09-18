---
title: "Markup check"
desc: "Test article: every wiki formatting element."
order: 3
updated: 2026-09-17
draft: true
---

This article is a test bench for every formatting element of the wiki: links, lists, tables, images, audio, callouts, footnotes and a sources block[^about].

## Text

A regular paragraph with **bold**, *italic*, `code` and a [link to another article](../lore/history.md). An external source looks like this: [mod website](https://example.org). And this is a link to an article that is not written yet: [Black Market Territory](black-market.md).

You can also link to a section inside the article: [jump to the table](#table).

## Lists

- Bulleted list: first item;
- second item with a nested list:
  - nested item;
  - another nested item;
- third item.

1. Numbered list: step one;
2. step two;
3. step three.

## Table

| Unit | Faction | Health |
| --- | --- | --- |
| Titan | Fenearth Republic | 4200 |
| Kraken | Proton Movement | 3100 |
| Zvezdochka | Proton Movement | 1800 |

## Quote

> Quotes fit character lines and excerpts from documents. **Emphasis** and [links](../factions/proton.md) work inside them too.

---

## Callouts

<div class="callout">
<strong>Tip.</strong> A regular callout for useful information along the way.
</div>

<div class="callout callout--warn">
<strong>Warning.</strong> A warning callout for important notes and limitations.
</div>

## Code

```bash
python3 -m http.server 8000
```

The code block has a "Copy" button in its top right corner.

## Images

A single image becomes a figure with a caption from its alt text:

![Galaxy map in the era of the Triple Conflict](../assets/img/lore/map-fenearth.avif)

Several images in one paragraph are collected into a gallery[^maps]:

![Oten Territory](../assets/img/lore/map-proton.avif) ![Vasst portrait](../assets/img/lore/vasst-portrait.avif)

## Audio

<div class="audio-card"><span class="audio-card__label">Anthem of the Fenearth Republic</span><audio controls preload="metadata" src="../assets/audio/fenearth-anthem.mp3"></audio></div>

### Third-level heading

Headings `###` also go into the table of contents and get an anchor for links.

## Sources

- [Steam Workshop: WWN mod](https://steamcommunity.com/sharedfiles/filedetails/?id=3247893564)
- [Galaxy history](../lore/history.md)

[^about]: The test article exists so that after any wiki change you can immediately see how each formatting element looks.
[^maps]: Era maps live in `assets/img/lore/` — see `assets/README.md` for details.
