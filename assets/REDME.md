# Changing the Background Image

This folder holds the background image for the Text Search app. Follow these steps to add or swap it.

## Folder Location

```
IT-211-project/
├── index.html
├── style.css
├── script.js
├── data/
└── assets/
    ├── README.md        <- this file
    └── background.jpg   <- your background image
```

## Steps

### 1. Prepare your image
- Use a `.jpg`, `.png`, or `.webp` file.
- Recommended size: **1920 x 1080 px** or larger.
- Keep the file under **1 MB** so the page loads quickly.
- Use a filename with no spaces (e.g., `background.jpg`).

### 2. Add the image to this folder
Place your image in `assets/`. The default expected name is **`background.jpg`**. If you use that exact name, no code changes are needed.

### 3. (Optional) Use a different filename
If your image has a different name or format, open `style.css`, find the `.bg-image` rule, and update the path:

```css
.bg-image {
  background-image: url("assets/your-image-name.png");
}
```

> The path is relative to `style.css`, which sits in the project root, so it starts with `assets/`.

### 4. Save and refresh
Reload the page in your browser. If the old image still shows, do a hard refresh:
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

Remember to serve the site over `http://` (e.g., `python3 -m http.server 8000`) rather than opening the file directly.

## Text Readability

The page already applies a dark gradient overlay on top of the background, so text stays readable on most photos. Very bright images may still need a darker overlay; adjust the gradient's opacity in `style.css`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Image doesn't appear | Check that the filename and extension match the path in `style.css` exactly (case-sensitive on GitHub Pages). |
| Image looks blurry or stretched | Use a higher-resolution image, ideally 16:9. |
| Change doesn't show after saving | Hard refresh, or clear the browser cache. |
| Image missing after pushing to GitHub | Make sure `assets/` isn't listed in `.gitignore`, then run `git add assets/` and commit again. |
