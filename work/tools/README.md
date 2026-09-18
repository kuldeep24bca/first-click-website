# Portfolio tools

Two scripts for capturing the website previews used in the project grid. Both
drive headless Chrome through the DevTools Protocol and need no npm install —
just Node 22+ and Google Chrome.

## Adding a project

1. **Capture the site.** Most sites:

   ```bash
   node tools/capture-preview.mjs https://example.com my-project
   ```

   Sites that only render as you scroll (GSAP/ScrollTrigger, pinned sections,
   smooth-scroll libraries) come out blank or full of gaps. Use frames instead:

   ```bash
   node tools/capture-scroll.mjs https://example.com my-project --frames 7
   ```

   That writes `tools/frames/my-project-0.png` … `-6.png` to stitch together.

2. **Resize it** to 900px wide WebP so the page stays light (previews are
   roughly 3000–4000px tall and 100–250KB each):

   ```bash
   python3 -c "
   from PIL import Image
   im = Image.open('assets/previews/my-project.png').convert('RGB')
   im = im.resize((900, int(im.height * 900 / im.width)), Image.LANCZOS)
   im.save('assets/previews/my-project.webp', 'WEBP', quality=72, method=5)"
   ```

3. **Add the card.** Copy any `<article class="project">` block in
   `index.html` and change six things:

   - `data-category` — `saas`, `ecommerce`, `agency`, `landing`, `restaurant`,
     `education` or `portfolio` (filter buttons for empty categories are
     removed automatically, so a new category needs a matching button)
   - `class` — `project--lg` (7 columns), `project--md` (5) or `project--sm` (4)
   - `href` on the `.project-frame` — the live URL
   - `.browser-url` — the domain shown in the fake address bar
   - `.browser-shot` `src` and `alt` — the preview image
   - the name, badge, description and services in `.project-info`

Keep the bento rhythm in rows that add up to 12 columns: 7 + 5, 5 + 7, or
4 + 4 + 4. Filtered views switch to an even 2-up grid automatically.

## Options

| Flag | Applies to | Default | Notes |
| --- | --- | --- | --- |
| `--width` | both | 1440 | Viewport width to capture at |
| `--max` | capture-preview | 5200 | Caps very tall pages |
| `--frames` | capture-scroll | 7 | Number of viewport frames |
| `--height` | capture-scroll | 900 | Viewport height per frame |

## When a site won't capture

Some sites block automated browsers (Cloudflare, Shopify bot protection) and
return "There was a problem loading the website". Screenshot those by hand at
1440px wide with a full-page capture extension, then resize as in step 2.
