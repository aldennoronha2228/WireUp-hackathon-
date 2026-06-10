# WireUp — Design System & Font Styles

## Font Families

| Token | Family | Fallback | Usage |
|---|---|---|---|
| `--font-sans` | **Inter** | -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif | Body, UI, nav, buttons, labels |
| `--font-serif` | **Instrument Serif** | Georgia, serif | Section headings, feature titles, why section |
| `--font-display` | **Playfair Display** | Georgia, serif | Hero heading, hero sub, hero kicker, icon captions |

**Google Fonts import:**
```
Inter: 300, 400, 500, 600, 700, 800
Instrument Serif: 400 normal, 400 italic
Playfair Display: 400, 600, 700 normal + italic
```

**Base font size:** `106.25%` on `<html>` (= ~17px) — all `rem` values scale from this.

---

## Colors

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0a0a0f` | Page background |
| `--surface` | `#111118` | Cards, panels |
| `--text` | `#f0f0f5` | Primary text |
| `--text-muted` | `#8888a8` | Subtitles, captions, descriptions |
| `--accent` | `#c8a0e0` | Accent links, highlights |
| `--accent-pink` | `#b04090` | Glow effects, animated elements |
| `--border` | `rgba(255,255,255,0.08)` | Borders, dividers |

---

## Navigation

### Brand / Logo
```
font-family: var(--font-sans)
font-size:   1.1rem
font-weight: 800
letter-spacing: -0.01em
line-height: 1.1
color: white
```

### Brand byline ("by NovaBoard AI")
```
font-size:   0.65rem
font-weight: 500
letter-spacing: 0.02em
color: var(--text-muted)
opacity: 0.8
```

### Nav links
```
font-family: var(--font-sans)
font-size:   0.85rem
color: var(--text-muted)
```

### Nav CTA button / Join Waitlist
```
font-size:   0.8rem
font-weight: 500
```

---

## Hero Section

### Kicker badge ("WIREUP BY NOVABOARD AI")
```
font-family:    var(--font-display)   ← Playfair Display
font-size:      0.78rem
font-weight:    600
letter-spacing: 0.28em
text-transform: uppercase
color: rgba(238, 232, 240, 0.66)
```

### Hero Heading (h1)
```
font-family: var(--font-display)   ← Playfair Display
font-size:   clamp(3.15rem, min(8.9vw, 8.2vh), 5.95rem)
font-weight: 400
line-height: 1.02
letter-spacing: 0

Mobile: clamp(2.32rem, 12vw, 3.25rem)
Small mobile: clamp(2.05rem, 11vw, 2.55rem)
```

### Hero Heading — `.accent-serif` (italic portion)
```
font-family: var(--font-serif)   ← Instrument Serif
font-style:  italic
font-weight: 400
```

### Hero Sub (paragraph under h1)
```
font-family: var(--font-display)   ← Playfair Display
font-size:   clamp(1.18rem, 2.65vh, 1.34rem)
font-weight: 600
line-height: 1.58
color: rgba(238, 232, 240, 0.46)

Mobile: 1rem
```

### Hero CTA button
```
font-family: var(--font-sans)
font-size:   1.05rem (desktop) / 0.86rem (mobile)
font-weight: 600
letter-spacing: -0.01em
```

### Hero pills track
```
font-size: 0.78rem
color: rgba(255, 255, 255, 0.45)
```

### Icon node captions ("Design", "WireUp Core", "Deployment")
```
font-family:    var(--font-display)
font-size:      0.7rem
font-weight:    600
letter-spacing: 0.14em
text-transform: uppercase
line-height:    1.2
color: rgba(238, 232, 240, 0.58)
```

---

## Brands Bar

```
font-family: var(--font-sans)
font-size:   1.1rem (desktop) / 0.95rem (tablet) / 0.9rem (mobile)
font-weight: 500
color: rgba(255, 255, 255, 0.35)
```

---

## Features Section

### Section label ("CORE FEATURES")
```
font-size:      0.75rem
letter-spacing: 0.1em
text-transform: uppercase
color: rgba(255, 255, 255, 0.6)
```

### Section heading (h2)
```
font-family:    var(--font-serif)   ← Instrument Serif
font-size:      clamp(2rem, 4vw, 3.2rem)
font-weight:    500
letter-spacing: -0.02em
line-height:    1.1
```

### Section description paragraph
```
font-size:   1.1rem
line-height: 1.6
color: rgba(255, 255, 255, 0.5)
```

### Feature card title (h3)
```
font-family: var(--font-serif)   ← Instrument Serif
font-size:   1.1rem
font-weight: 400
```

### Feature card paragraph
```
font-size:   0.92rem
line-height: 1.5
color: rgba(255, 255, 255, 0.55)
```

### Feature card list items
```
font-size: 0.85rem
color: rgba(255, 255, 255, 0.65)
```

---

## Why Section

### Section label
```
font-size:      0.7rem
letter-spacing: 0.28em
text-transform: uppercase
color: rgba(255, 255, 255, 0.7)
```

### Why heading (h2)
```
font-family: var(--font-serif)   ← Instrument Serif
font-size:   clamp(1.8rem, 3vw, 2.6rem)
font-weight: 400
```

### Word reveal paragraph
```
font-family: var(--font-sans)
font-size:   ~1rem
line-height: 1.6
color: var(--text-muted)   initially, animates to full opacity
```

### `.word-highlight` (animated highlight words)
```
color: var(--accent)   ← #c8a0e0
```

### Stat card heading (h3)
```
font-size:   1rem
font-weight: 600
```

---

## How It Works Section

### Section heading (h2)
```
font-size:   2rem
font-weight: 600
```

### Section paragraph
```
font-size:   0.95rem
color: var(--text-muted)
```

---

## Waitlist / Beta Form

### Beta kicker badge
```
font-size:      0.75rem
letter-spacing: 0.2em
text-transform: uppercase
color: rgba(255, 205, 250, 0.92)
```

### Beta heading
```
font-size:      clamp(2rem, 3.6vw, 3.1rem)
font-weight:    500
line-height:    1.15
letter-spacing: -0.02em
```

### Beta body paragraph
```
font-size:   0.98rem
line-height: 1.6
color: rgba(255, 255, 255, 0.55)
```

### Form field label
```
font-size:      0.78rem
font-weight:    600
letter-spacing: 0.02em
color: rgba(255, 255, 255, 0.68)
```

### Form input
```
font-family: var(--font-sans)
font-size:   0.98rem
color: #ffffff
```

### Submit button
```
font-family: var(--font-sans)
font-size:   1.05rem
font-weight: 600
letter-spacing: -0.01em
```

---

## Footer

### Logo text ("WireUp")
```
font-size:   1.8rem
font-weight: 800
```

### Footer description paragraph
```
font-size:   0.95rem
line-height: 1.6
color: rgba(255, 255, 255, 0.5)
```

### Footer nav group heading (h4)
```
font-size:      0.85rem
font-weight:    600
text-transform: uppercase
letter-spacing: 0.06em
```

### Footer nav links
```
font-size: 0.9rem
color: var(--text-muted)
```

### Footer contact email
```
font-size: 0.95rem
color: rgba(255, 255, 255, 0.7)
```

### Copyright
```
font-size: 0.85rem
color: rgba(255, 255, 255, 0.3)
```

---

## Type Scale Summary

| Size (rem) | Approx px | Used for |
|---|---|---|
| `0.65rem` | ~11px | Brand byline |
| `0.7rem` | ~12px | Icon captions, section label (sm) |
| `0.75rem` | ~12.75px | Section label, kicker badges |
| `0.78rem` | ~13.25px | Form labels, hero kicker, pills |
| `0.8rem` | ~13.6px | Nav CTA |
| `0.82rem` | ~14px | Hero note, form messages |
| `0.85rem` | ~14.4px | Nav links, footer h4, card lists |
| `0.86rem` | ~14.6px | Form field links |
| `0.9rem` | ~15.3px | Footer links |
| `0.92rem` | ~15.6px | Feature card body, beta body |
| `0.95rem` | ~16.15px | Feature card list, footer desc |
| `0.98rem` | ~16.65px | Beta body, form input |
| `1rem` | ~17px | Stat cards, body base |
| `1.05rem` | ~17.85px | Nav brand, CTA buttons |
| `1.1rem` | ~18.7px | Features header desc, brand bar |
| `1.1–1.25rem` | ~18–21px | Feature card h3 |
| `clamp(1.18–1.34rem)` | ~20–23px | Hero sub |
| `clamp(1.8–2.6rem)` | ~30–44px | Why h2 |
| `clamp(2rem–3.2rem)` | ~34–54px | Features / sections h2 |
| `clamp(3.15–5.95rem)` | ~53–101px | Hero heading h1 |

---

## Font Weight Reference

| Weight | Usage |
|---|---|
| `300` | Light (available, rarely used) |
| `400` | Body text, serif headings, hero heading |
| `500` | Subtitle paragraphs, nav links, brand bar |
| `600` | Hero sub, CTAs, labels, section sub |
| `700` | Headings (Playfair Display) |
| `800` | Logo text, nav brand, strong UI elements |
