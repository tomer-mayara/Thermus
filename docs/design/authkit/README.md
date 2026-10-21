# AuthKit branding bundle

This bundle implements the approved static panel and proposed hosted styles.
It contains no account credentials. Saved branding snapshots support rollback.
The manager tested the candidate in staging on 17 October 2026.
It is ready for production rollout after owner pull request review and the
production asset upload. Production is unchanged. The staging candidate remains
active.

## Files

- `branding-fields.json`: verified `updateAppBranding` field names and enum values.
- `panel.html` and `panel.css`: the same static left panel for sign-in and signup.
- `element-styles.json`: complete CSS rules by the verified `customCssElements`
  keys.
- `fonts.css`: Google-hosted font files for Sans 400/500/600, Serif 500, and Mono
  400. Set `customCssElements.authkitGlobal.css` to its contents. Staging
  confirmed that these font rules load the Serif heading.
- `manifest.json`: file mapping, prerequisites, and fields to preserve.
- `test/acceptance/auth/authkit-branding.test.ts`: executable acceptance checks
  for the copy and field scope.

## Apply

First save a complete copy of the current branding and match the production
client ID. Keep that backup outside the repository if it contains account data.
Use the same confirmed application and environment for apply and read-back.

Upload the exact logo and favicon from `src/interfaces/user-portal/public/assets/` to the
production branding. Set the dark logo to `thermus-logo.svg` and the dark
favicon to `thermus-favicon.svg`. Then replace `THERMUS_AUTHKIT_LOGO_URL` in
`panel.html` with the public logo URL. The panel does not redraw the logo.
Do not apply an unresolved token.

Set `font.family` to `IBM Plex Sans` without a `src` value. On 17 October 2026,
the manager verified in staging that this renders a stylesheet link to
`https://fonts.googleapis.com/css2?family=IBM+Plex+Sans&display=swap` and loads
the font. No `font.src` value is needed. The full candidate also loads
`fonts.css` through global CSS. Staging confirmed the 40px IBM Plex Serif
heading. The public Google CSS endpoint for all required faces is:

<https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@500&family=IBM+Plex+Mono:wght@400;500&display=swap>

Do not use an undeployed portal font URL. System fallbacks keep text readable
if a font fails, but do not establish an exact visual match.

`fonts.css` records the direct font URLs from that Google CSS response. Each
returned HTTP 200 with content type `font/ttf` on 17 October 2026. A CSS endpoint
returns font declarations; a gstatic URL returns the font file. Do not exchange
the two when setting `font.src`. This bundle uses the verified family-only
setting. The official WorkOS CLI schema exposes `family`, `src`, and `variant`
strings, but does not document how `src` is used. The
[Google Fonts API guide](https://developers.google.com/fonts/docs/developer_api)
defines family files and variants; it does not define WorkOS's input behavior.

The manager verified in staging that each `customCssElements` CSS string is
inserted literally in `@layer custom-elements`. It is not wrapped in a selector.
Bare declarations are ignored. Each file entry therefore uses complete CSS
rules. The class names come from the
[official branding guide](https://workos.com/docs/authkit/branding). Staging DOM
inspection confirmed `.ak-TextField` as the input wrapper, with an inner
`.rt-TextFieldInput`, and `.ak-Label` for its label. These rules keep the native
input and form intact. The card has a 464px maximum outer width and 32px padding,
which leaves a 400px form area.

Merge the fields with the verified branding `id`, the panel file contents, and
the selected CSS representation. Do not send null or reset values for omitted
settings. Keep Google/email methods, method order, redirects, legal links,
provider fields, and other native links as they are. No `resetCss` is used.

The hidden-on-mobile branding option controls the whole secondary panel.
The panel CSS also omits the diagram at 960px or less. Check the provider's
breakpoint so the form remains full width when the panel is hidden.

## Verify and roll back

Run `node --import tsx --test test/acceptance/auth/authkit-branding.test.ts`
before the commit.
These checks first failed while the artifact files were absent, then passed.
The actual input-selector check also failed before its correction. All three
checks now pass.

The manager verified the real hosted staging page with the complete CSS rules:

- The heading uses IBM Plex Serif at 40px.
- Inputs and buttons are 48px high.
- The 1440px desktop and 1024px tablet pages have no overflow.
- The 390px and 320px mobile pages have no overflow, and the secondary panel
  has zero width.
- Keyboard focus is visible on buttons.

The browser tool did not expose a working 200% page zoom control. The 320px
reflow check passed, but it is not evidence of a 200% zoom check.

These are visual staging results. The complete authentication gate results are
in the [validation record](../portal-validation.md). `THERMUS_AUTHKIT_LOGO_URL` is the only unresolved
asset in the bundle. Keep the staging logo URL out of the production payload.

After a branding save, read back the values. Inspect the real hosted page at
1440px, 1024px, 390px, and 320px, and at 200% text size. Check logo loading,
fonts, heading wraps, diagram labels, all four arrow directions, visible focus,
input boundaries, errors, password, verification, recovery, and signup screens.
Test the existing Google/email paths and app return routes. The panel is static
English content and does not auto-translate.

If the hosted view fails, restore the saved branding through the same confirmed
application and environment. Restore the former values of the changed fields.
The API rejected a null nested CSS entry in staging; an empty `css` string
removed that override. Asset paths are read-only in this API. Restore the
previous logo and favicon files through upload, or remove the new assets in
the branding editor if the backup had none. Do not reset the whole environment
or change authentication methods. Read back the restored values, then verify
the existing sign-in and return paths.

The [WorkOS guide](https://workos.com/docs/authkit/branding) documents a static
HTML/CSS panel and global style overrides. The provider sanitizes the HTML.
This panel uses no JavaScript, inline SVG, form, iframe, or event handler.
