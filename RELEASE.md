# Releasing

Pushing the tag is the whole release:

```bash
pnpm version:set 0.1.0        # package.json, deno.json and appConfig together
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

### 1. Update signing key

```bash
pnpm release:key
```

Writes an Ed25519 private key to `~/.ai-chat-manager/update-signing-key.pem`
(mode 600, outside the repository) and prints the public half.

```bash
gh secret set UPDATE_SIGNING_KEY < ~/.ai-chat-manager/update-signing-key.pem
```

The public half goes to builds through `UPDATE_PUBLIC_KEY`. A build given a
public key **rejects an unsigned feed**, which is the point: a release server
that loses its key cannot silently downgrade anyone to unsigned updates.

Rotating this key invalidates every build carrying the old public half. Treat it
as a release-breaking change.

### 2. macOS signing and notarization

Needs an **Apple Developer Program** membership. Without it, macOS builds are
ad-hoc signed and users see Gatekeeper warnings on first launch.

Export the *Developer ID Application* certificate as a `.p12`, then:

```bash
base64 -i cert.p12 | gh secret set MACOS_CERTIFICATE
gh secret set MACOS_CERTIFICATE_PASSWORD          # the .p12 password
gh secret set MACOS_SIGN_IDENTITY                 # Developer ID Application: Name (TEAMID)
gh secret set APPLE_ID                            # the account's email
gh secret set APPLE_TEAM_ID
gh secret set APPLE_APP_PASSWORD                  # app-specific password, not the account password
```

Find the identity string with `security find-identity -v -p codesigning`.

### 3. Windows signing

Export the code-signing certificate as a `.pfx`, then:

```bash
base64 -i cert.pfx | gh secret set WINDOWS_CERTIFICATE
gh secret set WINDOWS_CERTIFICATE_PASSWORD
```

### 4. Point builds at the feed

`deno.json` already carries `desktop.release.baseUrl`. Set `UPDATE_FEED_URL` to
the same value for the running app, and `UPDATE_PUBLIC_KEY` to the public half
from step 1. Without a feed URL the app simply never offers updates.

## Why full artifacts rather than patches

`Deno.autoUpdate()` applies bsdiff patches in place. Deno states plainly that
this is not signature-safe:

> This does not make the auto-update path signature-safe, and isn't trying to.
> Swapping the dylib breaks the seal wherever the bookkeeping files live.
> — [denoland/deno#36574](https://github.com/denoland/deno/pull/36574)

A patched macOS bundle fails `codesign --verify`, and Windows never applies
patches at all because the DLL is locked. So every platform downloads a whole
signed artifact, verifies it, hands off to an installer and exits. A running app
cannot replace itself, which is why macOS and Linux spawn a helper that waits for
the process to exit first, and Windows lets `msiexec` do it.

## Toolchain floor

**Deno 2.9.6 or newer.** [#36418](https://github.com/denoland/deno/issues/36418)
made a `deno desktop` macOS bundle fail `codesign --verify` two ways: the icon
was copied into `Contents/Resources` after signing, and the runtime wrote
`.update-ok` into `Contents/MacOS/` on every launch, so a distributed copy
invalidated itself on first run. Fixed 2026-08-26 and released in 2.9.6.

Homebrew may lag; the workflow pins the version itself.

Confirmed on this repo with Deno 2.9.5 and an icon configured:

```
$ codesign --verify --deep --strict dist/AIChatManager.app
dist/AIChatManager.app: a sealed resource is missing or invalid
file added: .../Contents/Resources/AppIcon.icns
```

The icon lands after signing, so it is outside the sealed resource list. The
symptom only appears once `desktop.app.icons` is set, which is why a bundle
without an icon can look fine on an old toolchain.

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
# the manifest verifies against the public key
node -e "..."                                   # or just run the app against the feed

# the macOS bundle is signed and notarized
codesign --verify --deep --strict --verbose=2 AIChatManager.app
spctl --assess --type execute --verbose AIChatManager.app
xcrun stapler validate AIChatManager.app
```

`spctl` is the one that answers the question users actually hit: whether
Gatekeeper lets it open without a trip to Privacy & Security.
