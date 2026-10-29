# ownsect

The OwnAI landing page, on its own: everything needed to work on it, build it
and serve it, with nothing from the rest of the repository.

```
index.html          the page
src/                scripts, styles, the ring (three.js)
build/              the build's own plugins: prerendered pages, panels, the local demo inbox
content/            the words, prices, workflows and links (was packages/content)
public/             films, posters, icons, social card, robots and sitemap
tools/              one-off generators (fonts, grain, the ring's first-frame image)
```

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # checks the content, type-checks, writes dist/
npm run preview    # serves dist/ as a host would, http://localhost:4173
```

`dist/` is the whole site: upload it to any static host.

The films and posters in `public/video/` were rendered from the screen
recording by the video app in the main repository (`apps/video`); they are
copied here as finished files, so nothing needs re-rendering to build.
