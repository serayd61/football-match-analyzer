// ============================================================================
// API DOCS - OpenAPI/Swagger Documentation
// /api/docs - Swagger UI
// /api/openapi.json - OpenAPI Spec
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/api/openapi';

export const dynamic = 'force-dynamic';

/**
 * GET /api/docs - Swagger UI HTML
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  // JSON format istenirse OpenAPI spec döner
  if (format === 'json') {
    return NextResponse.json(openApiSpec, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600',
      },
    });
  }

  // Varsayılan: Swagger UI HTML
  const swaggerUiHtml = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Football Match Analyzer API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
    .topbar {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/docs?format=json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: "list",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        requestInterceptor: (request) => {
          // Token'ı localStorage'dan al ve header'a ekle
          const token = localStorage.getItem('api_token');
          if (token && request.url.startsWith('/api/v2')) {
            request.headers['Authorization'] = 'Bearer ' + token;
          }
          return request;
        }
      });
      
      // Token input için UI element ekle
      const authInput = document.createElement('div');
      authInput.innerHTML = \`
        <div style="padding: 10px; background: #fff; border-bottom: 1px solid #ddd;">
          <label style="font-weight: bold; margin-right: 10px;">API Token:</label>
          <input type="password" id="api-token" placeholder="Bearer token" style="width: 300px; padding: 5px; border: 1px solid #ddd; border-radius: 3px;">
          <button onclick="setToken()" style="margin-left: 10px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">Set Token</button>
          <button onclick="clearToken()" style="margin-left: 5px; padding: 5px 15px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">Clear</button>
        </div>
      \`;
      document.body.insertBefore(authInput, document.getElementById('swagger-ui'));
      
      window.setToken = function() {
        const token = document.getElementById('api-token').value;
        localStorage.setItem('api_token', token);
        alert('Token saved! It will be used in API requests.');
      };
      
      window.clearToken = function() {
        localStorage.removeItem('api_token');
        document.getElementById('api-token').value = '';
        alert('Token cleared!');
      };
      
      // Saved token'ı yükle
      const savedToken = localStorage.getItem('api_token');
      if (savedToken) {
        document.getElementById('api-token').value = savedToken;
      }
    };
  </script>
</body>
</html>
  `;

  return new NextResponse(swaggerUiHtml, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}
