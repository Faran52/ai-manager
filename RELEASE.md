# Releasing

Pushing the tag is the whole release:

```bash
pnpm version:set 0.1.0        # package.json and appConfig together
# write the ## 0.1.0 section in CHANGELOG.md
git commit -am "chore: release 0.1.0"
git tag v0.1.0
git push origin main v0.1.0
```

The workflow refuses before it builds anything if the tag disagrees with the
version baked into the app, if `CHANGELOG.md` has no `## <version>` section, or
if `pnpm check` fails. Only then does it build, sign, notarize and publish.

Release notes are the changelog section for that version, with GitHub's
generated commit list underneath.

## One-time setup

### 1. macOS signing and notarization

Needs an **Apple Developer Program** membership. Without it, macOS builds are
ad-hoc signed and users see Gatekeeper warnings on first launch.

Export the *Developer ID Application* certificate as a `.p12`, then:

```bash
base64 -i cert.p12 | gh secret set MACOS_CERTIFICATE
gh secret set MACOS_CERTIFICATE_PASSWORD          # the .p12 password
gh secret set APPLE_ID                            # the account's email
gh secret set APPLE_TEAM_ID
gh secret set APPLE_APP_PASSWORD                  # app-specific password, not the account password
```

No signing identity string is needed: electron-builder reads the certificate
out of `CSC_LINK` and finds the identity in it.

### 2. Windows signing

Export the code-signing certificate as a `.pfx`, then:

```bash
base64 -i cert.pfx | gh secret set WINDOWS_CERTIFICATE
gh secret set WINDOWS_CERTIFICATE_PASSWORD
```

### 3. The update feed

There is nothing to set up. `electron-builder.yml` names this repository as the
provider, electron-builder writes `latest-mac.yml`, `latest.yml` and
`latest-linux.yml` beside the installers, the publish job attaches them to the
release, and electron-updater reads them back from there. Authenticity is the
code signature on the downloaded artifact, so there is no second key to rotate.

## Why full artifacts rather than patches

electron-updater replaces the whole bundle. A patched macOS bundle fails
`codesign --verify`, and Windows cannot apply a patch to a running install at
all, so one strategy serves every platform. macOS updates through the `zip`
target rather than the `dmg`, which is why both are built: a dmg is a download
for a person, a zip is one for the updater.

## Bundle size

The app is ~290 MB unpacked and ~129 MB as a dmg. Almost all of that is
Electron's own Chromium and Node; the app itself is `dist`, about 8 MB.

`electron-updater` is the only entry in `dependencies`, and that is deliberate.
`astro.config.mjs` sets `vite.ssr.noExternal`, which inlines every remaining
dependency into `dist/server`, so the packaged app carries no `node_modules`
tree worth the name. `image.service` is the passthrough service for the same
reason: nothing here uses `astro:assets`, and the default service drags Sharp's
per-platform libvips builds in behind it.

If a future dependency does something `noExternal` cannot bundle (a native
`.node` addon), it has to move back into `dependencies`, and the build breaks
loudly at runtime with a resolution error rather than shipping silently broken.

## Icons

`public/favicon.svg` is the only hand-authored artwork. Every raster beside it
is derived from it and committed, so no build step regenerates them:

| File | Used by |
|---|---|
| `icon-1024.png` | macOS bundle, converted to `AppIcon.icns` by the packager |
| `icon.ico` | Windows bundle, 16 through 256 in one container |
| `icon-512.png` | Linux AppImage |
| `icon-180.png` | apple-touch-icon |
| `icon-32.png` | classic favicon slot |

Changing the mark means editing the SVG and re-cutting those five. They change
about never, which is why they are committed rather than generated.

## Verifying a release by hand

```bash
# the macOS bundle is signed and notarized
codesign --verify --deep --strict --verbose=2 "AI Manager.app"
spctl --assess --type execute --verbose "AI Manager.app"
xcrun stapler validate "AI Manager.app"
```

`spctl` is the one that answers the question users actually hit: whether
Gatekeeper lets it open without a trip to Privacy & Security.

A local build, unsigned and unnotarized, is `pnpm desktop:pack`. It writes to
`release/`.
