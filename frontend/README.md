# AI Chatbot Frontend

Modern, responsive frontend for the serverless AI chatbot powered by Google Gemini.

## Features

- 💬 **Real-time Chat** - Instant responses from Gemini AI
- 🎨 **Image Generation** - Create images with simple commands
- 🛠️ **Smart Tools** - Weather, calculator, web search
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🎯 **Clean UI** - Modern, intuitive interface
- ⚡ **Fast & Lightweight** - Pure vanilla JavaScript, no frameworks
- 💾 **Session Management** - Persistent chat sessions
- 🌙 **Beautiful Design** - Gradient backgrounds and smooth animations

## Quick Start

### 1. Configure API Endpoint

Open `js/config.js` and update the `API_BASE_URL`:

```javascript
const CONFIG = {
    // Replace with your API Gateway URL from backend deployment
    API_BASE_URL: 'https://YOUR_API_GATEWAY_URL_HERE',
    // ...
};
```

To get your API Gateway URL:
1. Navigate to the `backend/` directory
2. Run `npm run deploy`
3. Copy the API endpoint from the output
4. Paste it into `config.js`

### 2. Test Locally

```bash
# Option 1: Python
python -m http.server 8000

# Option 2: Node.js
npx serve

# Option 3: PHP
php -S localhost:8000
```

Then open: http://localhost:8000

### 3. Deploy to S3

```bash
# Create S3 bucket (if not already created)
aws s3 mb s3://chatbot-frontend-YOUR-UNIQUE-ID

# Upload files
aws s3 sync . s3://chatbot-frontend-YOUR-UNIQUE-ID \
  --exclude ".git/*" \
  --exclude "README.md"

# Enable static website hosting
aws s3 website s3://chatbot-frontend-YOUR-UNIQUE-ID \
  --index-document index.html \
  --error-document index.html

# Set bucket policy for public access
aws s3api put-bucket-policy \
  --bucket chatbot-frontend-YOUR-UNIQUE-ID \
  --policy file://bucket-policy.json
```

Create `bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::chatbot-frontend-YOUR-UNIQUE-ID/*"
    }
  ]
}
```

Your website will be available at:
```
http://chatbot-frontend-YOUR-UNIQUE-ID.s3-website-REGION.amazonaws.com
```

## Project Structure

```
frontend/
├── index.html              # Main HTML file
├── css/
│   └── style.css          # Styles and responsive design
├── js/
│   ├── config.js          # Configuration and API endpoints
│   ├── app.js             # Main application logic
│   ├── chat.js            # Chat functionality
│   └── imageGenerator.js  # Image generation
├── assets/
│   └── images/            # Static images (if any)
└── README.md              # This file
```

## Usage Guide

### Chat Commands

#### Regular Chat
Just type your message and press Enter or click Send:
```
Hello! How are you today?
```

#### Image Generation
Use `/image` or `/img` prefix:
```
/image a futuristic city at sunset
/img a cute robot holding flowers
```

#### Weather
Ask about weather naturally:
```
What's the weather in Paris?
How's the temperature in London?
```

#### Calculator
Ask math questions:
```
Calculate 25 * 4
What is the square root of 144?
Solve 100 / 5 + 20
```

#### Web Search
Ask to search or find information:
```
Search for latest AI news
Find information about quantum computing
```

### Keyboard Shortcuts

- **Enter** - Send message
- **Shift + Enter** - New line in message
- **Escape** - Close image modal

### Features

#### Session Management
- Each session has a unique ID
- Sessions persist in browser local storage
- Click "New Chat" to start fresh conversation
- Click "Clear" to remove all messages from view

#### Image Modal
- Click any generated image to view full size
- Click outside or press Escape to close
- Images are stored in S3 with 30-day expiration

#### Responsive Design
- Optimized for desktop (1400px+)
- Tablet view (768px - 968px)
- Mobile view (< 768px)
- Sidebar auto-hides on mobile

## Configuration

### API Settings (`js/config.js`)

```javascript
const CONFIG = {
    // Your API Gateway URL
    API_BASE_URL: 'https://abc123.execute-api.us-east-1.amazonaws.com',

    // Endpoints
    ENDPOINTS: {
        CHAT: '/chat',
        GENERATE_IMAGE: '/generate-image',
        FUNCTION_CALL: '/function-call',
        GET_HISTORY: '/history'
    },

    // Settings
    SETTINGS: {
        MAX_MESSAGE_LENGTH: 5000,
        AUTO_SCROLL: true,
        REQUEST_TIMEOUT: 60000,
        DEBUG: false
    }
};
```

### Customization

#### Change Colors
Edit CSS variables in `css/style.css`:
```css
:root {
    --primary-color: #4a90e2;
    --user-msg-bg: #4a90e2;
    --ai-msg-bg: #f1f3f5;
    /* ... */
}
```

#### Change Gradient Background
```css
body {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

#### Disable Welcome Screen
In `js/config.js`:
```javascript
UI: {
    SHOW_WELCOME_SCREEN: false
}
```

#### Enable Debug Mode
```javascript
SETTINGS: {
    DEBUG: true
}
```

## Troubleshooting

### API Not Configured Error
**Error**: "API endpoint not configured"

**Solution**:
1. Deploy backend first: `cd backend && npm run deploy`
2. Copy API Gateway URL from deployment output
3. Update `API_BASE_URL` in `js/config.js`

### CORS Error
**Error**: "Access to fetch blocked by CORS policy"

**Solution**:
1. Check `serverless.yml` has `cors: true` for all endpoints
2. Redeploy backend: `serverless deploy`
3. Clear browser cache and retry

### Images Not Loading
**Error**: Images show broken link

**Solution**:
1. Check S3 bucket permissions
2. Verify Lambda has S3 PutObject permission
3. Check image URLs are signed correctly (1-hour expiry)

### Session Not Persisting
**Issue**: Session resets on page reload

**Solution**:
1. Check browser allows localStorage
2. Check browser is not in private/incognito mode
3. Clear browser cache and reload

### Mobile Layout Issues
**Issue**: UI doesn't fit on mobile

**Solution**:
1. Clear browser cache
2. Check viewport meta tag in HTML
3. Test in different mobile browsers

## Performance Optimization

### Minify Files
```bash
# Install terser for JS minification
npm install -g terser

# Minify JavaScript
terser js/app.js -c -m -o js/app.min.js
terser js/chat.js -c -m -o js/chat.min.js
terser js/imageGenerator.js -c -m -o js/imageGenerator.min.js

# Update index.html to use minified files
```

### Use CDN (CloudFront)
```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name chatbot-frontend-YOUR-ID.s3.amazonaws.com

# Update DNS records to point to CloudFront
```

### Enable Gzip Compression
When uploading to S3:
```bash
aws s3 sync . s3://your-bucket \
  --content-encoding gzip \
  --exclude "*" \
  --include "*.js" \
  --include "*.css" \
  --include "*.html"
```

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Security

### Content Security Policy
Add to `index.html`:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: https:;">
```

### HTTPS Only
Always serve over HTTPS in production. S3 static websites support HTTPS through CloudFront.

## Development

### Debug Mode
Enable in `config.js`:
```javascript
SETTINGS: {
    DEBUG: true
}
```

Then check browser console for detailed logs.

### Test API Endpoints
```javascript
// In browser console
CONFIG.debug('Testing API');

// Test chat
fetch(CONFIG.getApiUrl(CONFIG.ENDPOINTS.CHAT), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        message: 'Hello',
        sessionId: 'test-123'
    })
}).then(r => r.json()).then(console.log);
```

## Accessibility

- ✅ Keyboard navigation support
- ✅ ARIA labels for screen readers
- ✅ High contrast colors
- ✅ Responsive font sizes
- ✅ Focus indicators

## License

MIT

## Support

For issues and questions:
1. Check the main `tasks.md` in the root directory
2. Review backend `README.md` for API issues
3. Check browser console for errors
4. Verify API endpoint is configured correctly

## Credits

- **Design**: Modern chat UI inspired by leading chat applications
- **Icons**: Emoji icons (Unicode)
- **AI**: Powered by Google Gemini
- **Hosting**: AWS S3 + CloudFront

---

**Built with ❤️ for the serverless chatbot project**
