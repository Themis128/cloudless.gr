# Authentication Background Configuration

This document explains how the Vanta background with noise texture is configured for authentication pages.

## Overview

The authentication pages (login and signup) use the same Vanta clouds background effect as the rest of the site. The background requires a noise texture (`noise.png`) that is used to generate the cloud patterns.

## File Structure

The noise texture is available in multiple locations to ensure proper loading:

1. Main texture: `/public/gallery/noise.png`
2. Auth-specific texture: `/public/auth/gallery/noise.png`

## Why Multiple Locations?

Having the noise texture in multiple locations helps prevent issues with path resolution depending on the current route. When a user is on an authentication page (e.g., `/auth/login`), the relative path resolution might look for the texture in `/auth/gallery/noise.png`.

By duplicating the file in both the main gallery and the auth-specific gallery, we ensure the texture always loads correctly regardless of the current route.

## Usage in VantaBackground Component

The Vanta background component uses the texture for the 3D cloud effect:

```vue
<script setup lang="ts">
// VantaBackground.vue
onMounted(async () => {
  const VANTA = (await import('vanta/dist/vanta.clouds2.min')).default;
  const THREE = await import('three');

  // ...configuration...
  vantaEffect = VANTA({
    el: vantaRef.value,
    THREE,
    // ...other settings...
    noiseTexture: '/gallery/noise.png', // Path to texture
    // ...additional settings...
  });
});
</script>
```

## How to Update the Texture

If you need to update the noise texture:

1. Replace the file at `/public/gallery/noise.png`
2. Copy the same file to `/public/auth/gallery/noise.png`

```bash
# Example commands
# Replace the main texture
cp your-new-noise.png public/gallery/noise.png

# Update the auth-specific copy
cp your-new-noise.png public/auth/gallery/noise.png
```

## Troubleshooting

If the background appears without the cloud texture:

1. Check browser console for 404 errors related to `noise.png`
2. Verify that both texture files exist in the correct locations
3. Clear browser cache and reload the page
4. Ensure the VantaBackground component is correctly referencing the texture path

## Technical Details

The noise texture is a grayscale PNG image that provides the pattern information for the Vanta cloud effect algorithm. The texture is used to generate the displacement and detail in the cloud formations.

For optimal performance:
- Use a texture size of 256x256 or 512x512 pixels
- Use a grayscale PNG with alpha channel
- Keep file size under 100KB for faster loading
