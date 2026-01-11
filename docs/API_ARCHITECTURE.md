# 🏗️ API Architecture & Versioning Strategy

## 📋 İçindekiler
1. [API Versioning Strategy](#api-versioning-strategy)
2. [Route Organization](#route-organization)
3. [Endpoint Naming Conventions](#endpoint-naming-conventions)
4. [Request/Response Formats](#requestresponse-formats)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

---

## API Versioning Strategy

### Versiyonlama Yaklaşımı

API versiyonları URL path'inde belirtilir:

```
/api/v1/*  → Eski API (deprecated, migration edilecek)
/api/v2/*  → Aktif API (current)
/api/v3/*  → Gelecek versiyon (planning aşamasında)
```

### Version Management Rules

1. **Breaking Changes = Yeni Versiyon**
   - Request/response formatı değiştiyse → Yeni versiyon
   - Required field kaldırıldı/eklendi → Yeni versiyon
   - HTTP method değişti → Yeni versiyon

2. **Non-Breaking Changes = Aynı Versiyon**
   - Yeni optional field eklendi → Aynı versiyon
   - Response'a yeni field eklendi → Aynı versiyon
   - Bug fix → Aynı versiyon

3. **Deprecation Policy**
   - Eski versiyonlar en az 6 ay desteklenir
   - Deprecation warning header'ı eklenir: `X-API-Deprecated: true`
   - Migration guide dokümante edilir

---

## Route Organization

### 📁 Folder Structure

```
src/app/api/
├── v1/              # Eski API (deprecated)
│   ├── matches/
│   ├── analyze/
│   └── ...
├── v2/              # Aktif API (current)
│   ├── fixtures/
│   ├── analyze/
│   ├── predictions/
│   ├── performance/
│   └── ...
├── auth/            # Authentication (versionless)
│   ├── [...nextauth]/
│   └── register/
├── stripe/          # Payment (versionless)
│   ├── create-checkout/
│   ├── webhook/
│   └── portal/
├── cron/            # Cron jobs (internal)
│   ├── auto-analyze-matches/
│   └── settle-unified/
└── admin/           # Admin endpoints (protected)
    ├── stats/
    └── settle/
```

### Route Categories

#### 1. **Versioned Routes** (`/api/v2/*`)
Public API endpoint'leri - breaking changes için versiyonlanır.

**Examples:**
- `/api/v2/fixtures` - Maç listesi
- `/api/v2/analyze` - Analiz yap
- `/api/v2/predictions` - Tahminler

#### 2. **Versionless Routes**
Breaking change olmayan, internal/standard endpoint'ler.

**Categories:**
- **Auth** (`/api/auth/*`) - Authentication
- **Payment** (`/api/stripe/*`) - Stripe integration
- **User** (`/api/user/*`) - User-specific operations

#### 3. **Internal Routes**
System/internal işlemler için.

**Categories:**
- **Cron** (`/api/cron/*`) - Scheduled jobs
- **Admin** (`/api/admin/*`) - Admin operations
- **Webhooks** (`/api/stripe/webhook`) - External callbacks

---

## Endpoint Naming Conventions

### RESTful Principles

```
GET    /api/v2/fixtures          → Liste getir
GET    /api/v2/fixtures/:id      → Tekil kayıt getir
POST   /api/v2/fixtures          → Yeni kayıt oluştur
PUT    /api/v2/fixtures/:id      → Tam güncelleme
PATCH  /api/v2/fixtures/:id      → Kısmi güncelleme
DELETE /api/v2/fixtures/:id      → Sil
```

### Resource-Based Naming

✅ **Good:**
```
/api/v2/fixtures
/api/v2/analyze
/api/v2/predictions
/api/v2/performance
```

❌ **Bad:**
```
/api/v2/getFixtures
/api/v2/doAnalysis
/api/v2/createPrediction
```

### Query Parameters

**Pagination:**
```
?page=1&limit=20
```

**Filtering:**
```
?league_id=39&status=finished
?date=2024-01-15
```

**Sorting:**
```
?sort=date:desc
?sort=homeTeam:asc
```

---

## Request/Response Formats

### Standard Request Format

**Headers:**
```http
Content-Type: application/json
Authorization: Bearer <token>  # Authenticated endpoints için
X-API-Version: v2              # Opsiyonel, explicit version belirtmek için
```

**Body (POST/PUT/PATCH):**
```json
{
  "fixtureId": 12345,
  "homeTeam": "Arsenal",
  "awayTeam": "Chelsea",
  ...
}
```

### Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "processingTime": 123,
    "cached": false,
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retryAfter": 60
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/v2/analyze",
  "requestId": "req_1234567890_abc123"
}
```

### Response Headers

**Rate Limiting:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

**Caching:**
```
Cache-Control: public, s-maxage=300, stale-while-revalidate=600
X-Processing-Time: 123ms
```

**Deprecation:**
```
X-API-Deprecated: true
X-API-Sunset: 2024-07-15
```

---

## Error Handling

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `MISSING_REQUIRED_FIELD` | 400 | Required field missing |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `EXTERNAL_API_ERROR` | 500 | External API error |

### Error Response Example

```json
{
  "success": false,
  "error": "Fixture not found",
  "code": "NOT_FOUND",
  "details": {
    "fixtureId": 99999
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/v2/fixtures/99999",
  "requestId": "req_1234567890_abc123"
}
```

---

## Rate Limiting

### Rate Limit Presets

| Preset | Limit | Window | Type | Use Case |
|--------|-------|--------|------|----------|
| `PUBLIC` | 60 | 60s | IP | Public endpoints |
| `AUTHENTICATED` | 200 | 60s | User | Authenticated endpoints |
| `ANALYSIS` | 10 | 60s | User | Analysis endpoints (heavy) |
| `API_KEY` | 1000 | 60s | User | API key endpoints |
| `ADMIN` | 100 | 60s | User | Admin endpoints |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
Retry-After: 60  # 429 response'da
```

### Usage Example

```typescript
import { withApiMiddleware, RATE_LIMIT_PRESETS } from '@/lib/middleware/error-handler';

export const GET = withApiMiddleware(
  async (request: NextRequest) => {
    // Handler code
  },
  RATE_LIMIT_PRESETS.PUBLIC
);
```

---

## Migration Guide: v1 → v2

### Endpoint Mapping

| v1 | v2 | Changes |
|----|----|---------|
| `/api/matches` | `/api/v2/fixtures` | Renamed, improved response format |
| `/api/analyze` | `/api/v2/analyze` | Standardized response format |
| `/api/standings` | `/api/v2/standings` | Improved caching |

### Breaking Changes

1. **Response Format:** Tüm response'lar `{ success, data, meta }` formatına geçti
2. **Error Format:** Standart error code'ları eklendi
3. **Rate Limiting:** Header'lar eklendi

---

## Best Practices

### ✅ DO

1. **Use Versioned Routes** for public API endpoints
2. **Follow RESTful conventions** for resource naming
3. **Include meta information** in responses (processingTime, cached, etc.)
4. **Use middleware** for rate limiting and error handling
5. **Document breaking changes** in migration guide

### ❌ DON'T

1. **Don't use verbs** in endpoint names (`/getFixtures` ❌)
2. **Don't mix versions** in same endpoint
3. **Don't skip error handling** - always use error middleware
4. **Don't expose internal errors** in production
5. **Don't break backward compatibility** without deprecation period

---

## API Documentation

API dokümantasyonu için OpenAPI/Swagger kullanılır:
- **Swagger UI:** `/api/docs`
- **OpenAPI Spec:** `/api/openapi.json`

Detaylar için `docs/API_DOCUMENTATION.md` dosyasına bakın.
