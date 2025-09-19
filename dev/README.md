# Development Version of Staple Games Website

This directory contains the development version of the Staple Games website.

## Files

- **`index-v2.html`** - Redesigned homepage with game-inspired design system
- **`style-guide.html`** - Complete design system reference and component library  
- **`index.html`** - Original development version with password protection
- **`hp-backup-9-19-25.html`** - Backup of the original homepage (Sept 19, 2025)
- **`.htaccess`** - Server configuration for development environment

## Quick Links

- **New Homepage**: `https://staplegames.com/dev/index-v2.html`
- **Style Guide**: `https://staplegames.com/dev/style-guide.html`
- **Original Dev**: `https://staplegames.com/dev/index.html`

## Design System (v2)

The new design uses a game-inspired aesthetic with:
- **3D Shadow Technique**: Wrapper-based shadows with 6px offset
- **Brand Colors**: Gold primary (#FFCC00) with supporting palette
- **Typography**: Bold, playful headings with clean body text
- See `style-guide.html` for complete documentation

## Access Protection

This development site is protected by multiple layers:

1. **JavaScript Password Protection** (index.html only)
   - Password: `stapledev2024`
   - Session duration: 24 hours
   - To change the password, edit the `DEV_PASSWORD` variable in `index.html`

2. **Search Engine Blocking**
   - Meta tags prevent indexing
   - robots.txt blocks crawling of /dev/
   - .htaccess adds X-Robots-Tag headers

3. **Visual Indicator**
   - Orange banner at the top indicates this is the development version

## Usage

- Access the dev site at: `https://staplegames.com/dev/`
- Make changes to test new features before deploying to production
- Refer to `style-guide.html` for design consistency

## Additional Security Options

The `.htaccess` file includes commented-out options for:
- IP restriction (limit access to specific IP addresses)
- HTTP Basic Authentication (server-level password protection)

Uncomment and configure these options if you need additional security.

## Important Notes

- This is NOT for production use
- Changes here do not affect the live site
- Remember to test thoroughly before copying changes to the main site 