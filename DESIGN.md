---
name: Cha-Ching
description: A cutoff-based peso budget written like a palengke price board.
colors:
  marker-ink: "#1A1714"
  kraft: "#C99A5B"
  kraft-deep: "#A87C42"
  marker-red: "#D62718"
  marker-blue: "#1F5FBF"
  paid-green: "#2F7D4F"
  board: "#F3EADA"
  manila: "#FFFDF8"
  ink-2: "#5A5048"
  rule: "#E3D5BC"
  tick-ring: "#CDBB9C"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "32px"
  title:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
    fontFeature: "\"tnum\" 1"
  section:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "24px"
  figure:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "20px"
    fontFeature: "\"tnum\" 1"
  figure-struck:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "16px"
    fontFeature: "\"tnum\" 1"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "20px"
    fontFeature: "\"tnum\" 1"
  body-strong:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
  caption:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    fontFeature: "\"tnum\" 1"
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "12px"
rounded:
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  row: "10px"
  md: "12px"
  gutter: "16px"
  card-lg: "20px"
  section: "24px"
components:
  header-band:
    backgroundColor: "{colors.kraft}"
    textColor: "{colors.marker-ink}"
    padding: "12px 16px 16px"
  card:
    backgroundColor: "{colors.manila}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.marker-ink}"
    textColor: "{colors.manila}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
  button-primary-disabled:
    backgroundColor: "{colors.tick-ring}"
    textColor: "{colors.manila}"
    rounded: "{rounded.lg}"
  button-small:
    backgroundColor: "{colors.marker-ink}"
    textColor: "{colors.manila}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  nav-button:
    backgroundColor: "transparent"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.md}"
    size: "40px"
  chip:
    backgroundColor: "{colors.manila}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  chip-selected:
    backgroundColor: "{colors.marker-ink}"
    textColor: "{colors.manila}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  pill-received:
    backgroundColor: "{colors.marker-blue}"
    textColor: "{colors.manila}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  tab-bar:
    backgroundColor: "{colors.manila}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
  tab-active:
    textColor: "{colors.marker-ink}"
  add-fab:
    backgroundColor: "{colors.marker-ink}"
    textColor: "{colors.kraft}"
    rounded: "{rounded.full}"
    size: "56px"
  pin-key:
    backgroundColor: "{colors.manila}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.full}"
    size: "72px"
  amount-bar:
    backgroundColor: "{colors.marker-ink}"
    rounded: "{rounded.full}"
    height: "8px"
  amount-bar-track:
    backgroundColor: "{colors.rule}"
    rounded: "{rounded.full}"
    height: "8px"
---

# Design System: Cha-Ching

## Overview

**Creative North Star: "The Palengke Price Board"**

Every peso is written big and plain, the way a market stall chalks its prices: a corrugated-kraft band across the top carries the one number that matters right now, and beneath it a warm board ground holds near-white manila cards where each line has its name on the left and its price, in heavy condensed marker, on the right. The world is flat and handmade in temperament but strict in arithmetic. Figures share one numeral face on a short size ladder, every figure is tabular, and amounts line up in a single right-hand column so centavos stack.

Length is amount. Wherever pesos are compared, an ink bar is drawn to exact scale against the largest value on a pale rule track, and rosters are ranked biggest first. Colour is spent like a market vendor spends marker ink: black for everything, red only to mark a price down when a budget is overspent or a limit is nearly hit, blue only for money coming in. The system refuses the fintech header: no gradient band, no centred hero metric, no chip soup around the total.

Dark mode is the same world at night, not a second theme. The kraft band deepens to a dark kraft, the board goes to near-black brown, manila cards become dark card stock, ink figures turn to board cream, and the markers lighten to stay legible. Structure, type, and every rule below hold unchanged.

**Key Characteristics:**
- Kraft header band, board ground, manila cards, marker-ink figures.
- Barlow Condensed 700 to 800 for every figure and heading; Barlow for running text.
- Tabular figures everywhere; amounts right-aligned in one fixed-width column.
- Ranked rosters with ink bars drawn to exact peso scale.
- Red and blue are signals, never decoration.
- Flat: 1px rules, one hairline card shadow, no gradients.

## Colors

A kraft-and-manila market palette with one ink and two signal markers.

### Primary
- **Marker Ink** (marker-ink): every figure, every heading, the primary action fill, selected chips, and every amount bar. On the kraft band it is also the colour of money in (see the Marker Discipline Rule).

### Secondary
- **Corrugated Kraft** (kraft): the header band on every top-level screen, the 3px active-tab indicator, the plus glyph inside the ink Add button, the browser theme colour, and text selection. Nowhere else.
- **Deep Kraft** (kraft-deep): the 1px rule under the header band and the pressed state of band nav buttons.

### Tertiary
- **Price-Markdown Red** (marker-red): over-budget amounts and their struck-through budget, "Over by" helper text, credit-limit bars at 90% utilisation or more, destructive "Remove" actions, and error text. Contrast on manila is 4.96:1.
- **Money-In Blue** (marker-blue): income figures, the cutoff's "In" total, and the "Received" pill, on manila or board grounds only (about 6:1 on manila, 5.1:1 on board).
- **Paid Green** (paid-green): the filled tick circle of a paid line. It marks a completed action, not money.

### Neutral
- **Board** (board): the page ground behind all cards, and the field fill of inline selects.
- **Manila** (manila): cards, the tab bar, chips at rest, PIN keys.
- **Ink 2** (ink-2): secondary text (channel names, dates, helper lines, captions, inactive tabs, unselected chip text).
- **Rule** (rule): every 1px card border, list divider, and the track under amount bars.
- **Tick Ring** (tick-ring): the empty ring of an unpaid line, and the disabled primary button.

### Named Rules
**The Marker Discipline Rule.** Red marks only over-budget, near-limit, destructive, and error states. Blue marks only money in, and only on manila or board: it fails contrast on kraft (2.4:1), so on the kraft band money in is set in bold marker ink ("Came in" at weight 600) and the rest of the line stays ink at reduced emphasis.

**The Kraft Band Rule.** Kraft belongs to the band and to the active-tab tick. Never fill a card, chip, or button with kraft.

**The Same World at Night Rule.** Dark mode remaps the same tokens (ground #15120F, cards #211C17, band #6B4F2A, text #F3EADA and #CDBB9C, rules #3A322A, blue #8FB0F0, red #FF6B5E, paid green #3E9A64). It adds no new colours and changes no layout. Ink fills invert to cream with dark text, so the Add button and amount bars become cream on dark.

## Typography

**Display Font:** Barlow Condensed (with Barlow, sans-serif)
**Body Font:** Barlow (with system-ui, sans-serif)

**Character:** A narrow, heavy sign-writer's face for prices and headings, paired with its own plain-spoken text cut, so a figure and its label read as one hand.

### Hierarchy
- **Display** (Barlow Condensed 800, 44px, line-height 1): the single hero figure in the kraft band (outgoing total, interest-bearing debt, logged expenses). The peso sign sits at 0.6em, top-aligned, like a stall price tag.
- **Headline** (Barlow Condensed 700, 28px, 32px): screen title in the band when there is no hero figure; PIN keys use the same size.
- **Title** (Barlow Condensed 700, 22px, 28px): cutoff names, the cutoff's closing "In · Surplus" line, and collapsed-cutoff totals.
- **Section** (Barlow Condensed 700, 20px, 24px): card headings such as "Where it goes" and debt-card names.
- **Figure** (Barlow Condensed 700, 17px, 20px): every line amount, group total, income amount.
- **Figure Struck** (Barlow Condensed 600, 13px): the budget under an overspent figure, struck through.
- **Body** (Barlow 500, 16px, 20px): line and income names.
- **Body Strong** (Barlow 600, 15px): roster group labels and the band's lead-in line.
- **Caption** (Barlow 400, 12px, 16px): channel, day, "left of", "of paid" helper lines, in ink 2.
- **Label** (Barlow 500 to 600, 11px): tab labels, status pills.

### Named Rules
**The Price-Tag Rule.** Every peso amount is Barlow Condensed at 700 or heavier with tabular figures, right-aligned in a fixed 7.5rem column so centavos stack down the card.

**The One Ladder Rule.** Figures take only the sizes on the ladder (44, 28, 22, 20, 17, 13). Do not invent intermediate figure sizes.

## Layout

A single phone column (max 448px) with a 16px gutter. The kraft band breaks out full-bleed and covers the top safe-area inset; its content snaps back to the column, left-aligned: nav row (40px square buttons either side of a centred month label), lead-in line, hero figure, then a one-line summary. Below it, cards stack on the board with 16px between them and 24px between cutoff sections; card padding is 16px (20px on the Quick Add form). Inside cards, list rows are 10px top and bottom with a 1px rule divider; chips wrap with 8px gaps. The tab bar is fixed to the bottom over the home-indicator inset.

**The Length-Is-Amount Rule.** Comparisons are horizontal ink bars (8px, 4px for per-line budget bars) on a rule-coloured track, each drawn to its exact share of the largest value, ranked biggest first. No pie charts, no rounded-off segments.

## Elevation & Depth

Flat by default. Depth comes from the ground change (board to manila) and 1px rules, with one barely-there hairline shadow under cards. The only lifted object is the ink Add button, which rises 12px above the tab bar with a soft drop. Dialogs sit on a 40% black scrim. In dark mode every shadow is replaced by a 1px #3A322A ring, because shadows read as glow on dark ground.

### Shadow Vocabulary
- **Card hairline** (`box-shadow: 0 1px 2px rgb(26 23 20 / 0.06)`): every manila card.
- **Add lift** (`box-shadow: 0 4px 12px rgb(26 23 20 / 0.25)`): the Add button only.

### Named Rules
**The Flat Board Rule.** No gradients anywhere, including the band. A new surface gets a rule border and the card hairline, never a heavier shadow.

## Shapes

Gently rounded, never soft. Cards, the primary button, and list-row containers take a 12px radius; band nav buttons and small action buttons take 8px. Everything that is a token rather than a surface is a full pill or circle: chips, status pills, the tick circle, PIN keys and PIN dots, amount bars and their tracks, and the Add button. Borders are 1px throughout, except the 2px tick ring and the 2px underline on the amount field.

## Components

### Buttons
- **Shape:** gently rounded (12px) for full-width primaries; 8px for small inline actions.
- **Primary:** marker-ink fill, manila text, Barlow 600 16px, 14px vertical padding, full width (Save on Quick Add).
- **Disabled:** tick-ring fill, manila text.
- **Small action:** marker-ink fill, manila 12px semibold, 6px by 12px.
- **Outline:** full pill, 1px ink border, transparent fill, ink 12px semibold text (Enter statement).
- **Text action:** ink semibold with underline (Log payment, Edit, Import).
- **Band nav:** 40px square, 8px radius, 1px ink border at 30% opacity, transparent, chevron icon; pressed state deep kraft at 30%.
- **Focus:** a 2px ink outline offset 2px on every focusable element (cream in dark mode).

### Chips
- **Style:** full pill, 12px Barlow, 6px by 12px, manila fill, 1px rule border, ink-2 text. Card chips carry a 14px card icon.
- **State:** selected chips switch to marker-ink fill with manila text; nothing else changes.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** manila on board.
- **Shadow Strategy:** card hairline (see Elevation).
- **Border:** 1px rule.
- **Internal Padding:** 16px (20px for the Quick Add form).

### Inputs / Fields
- **Amount field:** borderless, a peso sign in Barlow Condensed ink 2 followed by a 30px Barlow Condensed tabular figure, on a 2px rule underline that turns ink on focus.
- **Text fields:** borderless with a 1px rule underline.
- **Inline selects:** board-filled pill with a 1px rule border.

### Navigation
- **Tab bar:** manila, 1px rule top border, five equal slots with 24px line icons over 11px labels. Inactive tabs are ink 2 at weight 500; the active tab is ink at weight 600 with a 3px by 40px kraft bar at the top edge.
- **Add:** the centre slot is a 56px marker-ink circle lifted 12px, holding a 28px kraft plus-in-circle icon.
- **Icons:** inline SVG line icons, 24px grid, 1.75 stroke, round caps, currentColor.

### Header Band (signature)
Full-bleed kraft with a 1px deep-kraft bottom rule. Optional nav row, then a lead-in line (Barlow 500 15px), then the display figure, then a 13px summary line in ink at 80%. A band may hold a nested breakdown panel: a 1px ink-at-20% bordered, 12px-rounded box of name and figure rows divided by ink-at-15% rules.

### Where It Goes (signature)
A manila card titled in the section style. Each group is a row of Body Strong label and Figure amount, with an 8px ink bar beneath on a rule track, sized to the largest group. A caption closes it ("Ranked by pesos · n lines").

### Line Row (signature)
Tick circle (20px, 2px tick-ring border; paid fills paid green with a manila check), then name in Body over a caption of channel and tags, then the amount in Figure in the right-hand 7.5rem column. A paid row dims its name block to 60% and shows its status word beneath the amount. Budget lines add a 4px by 96px ink bar and a "left of" caption. An overspent budget line is the price markdown: spent figure in marker red, the budget beneath in Figure Struck with a 2px marker-red strike, and "Over by" in red semibold caption.

### PIN Pad
Board ground, the app name in Barlow Condensed 800 40px, six 16px ring dots filling with ink, and a 3 by 3 grid of 72px manila circular keys with 1px rule borders and 28px condensed numerals; the backspace key is an SVG icon.

## Do's and Don'ts

### Do:
- **Do** set every peso in Barlow Condensed 700+ with tabular figures, right-aligned in the 7.5rem amount column.
- **Do** rank breakdowns biggest first and draw ink bars to exact proportion of the largest value.
- **Do** keep the hero figure left-aligned in the kraft band, with the peso sign small and top-aligned.
- **Do** show money in as bold ink on the kraft band and as marker blue on manila or board.
- **Do** mark an overspend with the red figure over the struck budget, and nothing more.
- **Do** carry dark mode by remapping tokens under the dark class, keeping the same structure.

### Don't:
- **Don't** use gradients, including on the header band.
- **Don't** centre the hero metric or surround it with chips.
- **Don't** use marker red for anything that is not over-budget, near-limit, destructive, or an error.
- **Don't** set marker blue on kraft; it fails contrast there.
- **Don't** use marker blue as a focus or accent colour; focus is ink.
- **Don't** fill cards, chips, or buttons with kraft.
- **Don't** add uppercase, letter-spaced eyebrow labels above headings or figures.
- **Don't** add figure sizes off the ladder, or proportional figures in any amount.
