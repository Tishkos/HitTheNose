# Art guide: swapping in hand-painted art

The game draws everything itself in the style of the HIT THE NOSE poster: inked outlines, painted shading, film grain and a worn poster frame. If you want even more painterly detail, you can replace any layer with an image painted or generated in the poster style. Layers you don't replace keep the built-in art.

1. Put the image in `www/assets/art/`.
2. List it in `www/assets/art/art-manifest.js`:

```js
window.HTN_ART = {
  background: 'background.jpg',
  general: 'general.png',
  'man-idle': 'man-idle.png',
};
```

3. Reload. For the apps, run `npx cap sync` first.

## Layers

| Name | Size (px, 3x) | Transparent | What it is |
|---|---|---|---|
| `background` | 720 x 786 | no | The room only: red burning skyline, factory girders, "A BRIGHTER TOMORROW (TM)" billboard top right, dark wall and floor. **No characters.** |
| `devil` | 390 x 336 | yes | Horned devil head and shoulders, glowing eyes, wide toothy grin. Centred, looking at the viewer. |
| `general` | 120 x 174 | yes | Caricature general: peaked cap, medals, holding a platter of raw meat. Feet at the bottom edge. |
| `politician` | 120 x 174 | yes | Caricature politician in a dark suit and red tie, holding a crate of cash. |
| `baby` | 48 x 48 | yes | Cartoon baby sitting, in a nappy, worried look. |
| `man-body` | 420 x 240 | yes | The man's torso in an olive t-shirt, forearms resting on the table. The neck is at the top centre. |
| `man-idle`, `man-lean`, `man-hit`, `man-snort`, `man-high`, `man-dazed`, `man-alone` | 192 x 228 | yes | His head, one image per expression, with the big red nose at about 62% of the height. Only `man-idle` is required. Missing expressions fall back to it. |

Keep the same proportions. The game scales each image into its slot.

## Style prompt (for an illustrator or image generator)

> Gritty 1970s arcade movie poster illustration, heavy black ink outlines, painterly comic shading, aged print texture, palette of deep red, black, mustard yellow, olive and cream, dramatic red backlight, satirical caricature, **[subject]**, full figure centred, plain transparent background.

**The man at the table must be an invented character.** Don't base him, or any general or politician, on a real, recognisable person. A likeness of a real person is a defamation risk, and the App Store and Google Play reject apps that attack real individuals.
