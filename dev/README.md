# Development Version of Staple Games Website

This directory contains the development version of the Staple Games website.

## Access Protection

This development site is protected by multiple layers:

1. **JavaScript Password Protection**
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
- The dev version is an exact copy of the main site with added protections

## Additional Security Options

The `.htaccess` file includes commented-out options for:
- IP restriction (limit access to specific IP addresses)
- HTTP Basic Authentication (server-level password protection)

Uncomment and configure these options if you need additional security.

## Important Notes

- This is NOT for production use
- Changes here do not affect the live site
- Remember to test thoroughly before copying changes to the main site 