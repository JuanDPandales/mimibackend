# 🐾 Mimi Store — Backend API

API REST construida con **NestJS + TypeScript** siguiendo **Arquitectura Hexagonal (Ports & Adapters)** y **Railway Oriented Programming (ROP)**. Integra pagos con **Payment Gateway Sandbox**.

---

## Tabla de Contenidos

1. [Prerrequisitos](#1-prerrequisitos)
2. [Estructura de carpetas](#2-estructura-de-carpetas)
3. [Instalación del proyecto](#3-instalación-del-proyecto)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Base de datos con Docker](#5-base-de-datos-con-docker)
6. [Arquitectura Hexagonal](#6-arquitectura-hexagonal)
7. [Shared Kernel — ROP y utilidades](#7-shared-kernel--rop-y-utilidades)
8. [Módulo: Products](#8-módulo-products)
9. [Módulo: Stock](#9-módulo-stock)
10. [Módulo: Customers](#10-módulo-customers)
11. [Módulo: Deliveries](#11-módulo-deliveries)
12. [Módulo: Transactions](#12-módulo-transactions)
13. [Seguridad y Buenas Prácticas Extendidas](#13-seguridad-y-buenas-prácticas-extendidas)
14. [App Module y Bootstrap](#14-app-module-y-bootstrap)
15. [Seed de la base de datos](#15-seed-de-la-base-de-datos)
16. [Correr el proyecto](#16-correr-el-proyecto)
17. [Tests](#17-tests)
18. [Endpoints de la API](#18-endpoints-de-la-api)
19. [Modelo de datos](#19-modelo-de-datos)

---

## 1. Prerrequisitos

Antes de empezar asegúrate de tener instalado:

| Herramienta | Versión mínima | Verificar |
|-------------|---------------|-----------|
| Node.js | 20.x | `node -v` |
| pnpm | 9.x+ | `pnpm -v` |
| Docker Desktop | 24.x | `docker -v` |
| Docker Compose | 2.x | `docker compose version` |
| Git | cualquiera | `git -v` |

> **Nota:** No necesitas PostgreSQL instalado localmente. Docker lo levanta por ti.

---

## 2. Estructura de carpetas
(...) *(Manteniendo la estructura provista inicialmente)*

---

## 3. Instalación del proyecto

```bash
cd backend
pnpm install
```

---

## 4. Variables de entorno

```env
# App
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database (AWS RDS)
DB_HOST=mimidatabase.id.us-east-2.rds.amazonaws.com
DB_PORT=5432
DB_USER=postgres
DB_PASS=PUnPr333123sss0rf
DB_NAME=mimidatabase

# TypeORM / Prisma connection string
DATABASE_URL=postgresql://postgres:PUnPr333123sss0rf@mimidatabase.id.us-east-2.rds.amazonaws.com:5432/postgres

# Payment Gateway Sandbox
GATEWAY_SANDBOX_URL=https://api-sandbox.co.uat.payment-gateway.dev/v1
GATEWAY_PUB_KEY=pub_stagtest_g2u0HQd3ZMh05hsSgTS2lUV8t3s4mOt7
GATEWAY_PRV_KEY=prv_stagtest_5i0ZGIGiFcDQifYsXxvsny7Y37tKqFWg
GATEWAY_EVENTS_KEY=stagtest_events_2PDUmhMywUkvb1LvxYnayFbmofT7w39N
GATEWAY_INTEGRITY_KEY=stagtest_integrity_nAIBuqayW70XpUqJS4qf4STYiISd89Fp

# Tarifas
BASE_FEE=3500
DELIVERY_FEE=8000
```

---

## 5. Base de datos con Docker

El archivo `docker-compose.yml` en la raíz del proyecto levanta PostgreSQL y pgAdmin.

```bash
docker compose up -d
```

| Servicio | Puerto | Credenciales |
|----------|--------|-------------|
| PostgreSQL | `5432` | user: `pawsome` / pass: `pawsome123` / db: `pawsome_store` |
| pgAdmin | `5050` | email: `admin@pawsome.dev` / pass: `admin123` |

---

## 6. Arquitectura Hexagonal

Cada módulo sigue exactamente esta separación de capas:

```
domain/          → Entidad pura + interfaz del repositorio (Port)
application/     → Use Cases que orquestan la lógica
infrastructure/  → ORM entities + repositories concretos (Adapters)
presentation/    → Controllers NestJS
```

**Regla de oro:** Las dependencias solo apuntan hacia adentro.
`presentation → application → domain ← infrastructure`

---

## 7. Shared Kernel — ROP y utilidades

### 7.1 Railway Oriented Programming — `src/shared/result/result.ts`
Todos los use cases retornan `Result<T, E>` en lugar de lanzar excepciones.

### 7.2 AuditLogger — `src/shared/audit/`
Logger estructurado con Winston. Registra cada evento financiero con timestamp, IP, IDs y estado, encriptando o ignorando PII (Personal Identifiable Information).

### 7.3 PaymentGatewayService — `src/shared/payment-gateway/payment-gateway.service.ts`
Adapter que encapsula la comunicación externa.

### 7.4 Configuraciones — `src/shared/config/`
- Rate limit escalonado (`throttler.config.ts`).
- Configuración de logging (`winston.config.ts`).

---

## 8. Módulo: Products
Define `Product`, ORM Entities y Use Cases: `get-products` y `get-product-by-id`. Retorna la hidratación con el stock disponible.

## 9. Módulo: Stock
Encapsula la lógica de dominio del inventario (`isAvailable()`, `decrement()`). Mantiene reglas sólidas de reserva.

## 10. Módulo: Customers
Gestión de identidades centralizada con lógica `upsertByEmail` para conciliar compras repetidas usando el mismo email o actualizando datos rápidamente.

## 11. Módulo: Deliveries
Crea las intenciones de distribución del envío una vez la pasarela autoriza las transacciones de pago de las órdenes.

## 12. Módulo: Transactions
El módulo más complejo. Orquesta `ProcessPaymentUseCase` con transacciones de base de datos atomizadas mediante **dos QueryRunners** para evitar bloqueos innecesarios durante el "I/O bound" que representa conectarse a la pasarela de pago remota. Usa DTOs estrictos por validadores.

---

## 13. Seguridad y Buenas Prácticas Extendidas

Además de la arquitectura, este proyecto adopta múltiples capas de seguridad exhaustiva para entornos transaccionales:

### 13.1 Rate Limiting — `@nestjs/throttler`
Configurado en `ThrottlerModule.forRoot()` con tres niveles. El `ThrottlerGuard` se aplica globalmente como `APP_GUARD` en `AppModule`. Se puede sobreescribir por ruta con el decorador `@Throttle({ nombre: { limit, ttl } })`.

### 13.2 Idempotency Key — `IdempotencyInterceptor`
El frontend debe enviar el header `X-Idempotency-Key: <uuid-único>` en cada POST a `/transactions`.
Esto previene el doble cobro ante: doble-click del usuario, retries de red o bugs del frontend.

### 13.3 DB Transactions Atómicas — QueryRunner
`SELECT FOR UPDATE` con aislamiento `SERIALIZABLE` garantiza que dos usuarios comprando el último producto al mismo tiempo no ambos reciban `APPROVED`. 

### 13.4 Helmet — Headers de seguridad OWASP
Configurado explícitamente en `main.ts`:
- `Content-Security-Policy`
- `Strict-Transport-Security` (HSTS, 1 año)
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection`
- `Referrer-Policy: strict-origin-when-cross-origin`

### 13.5 ValidationPipe y ParseUUIDPipe
- `whitelist: true` → elimina propiedades no declaradas en el DTO.
- `forbidNonWhitelisted: true` → lanza error 400 si llegan propiedades extra que podrían suponer inyección de objetos.
- **Validación Fuerte de Datos por URL**: Todos los IDs recibidos (ej. `/api/transactions/:id`) se resuelven a través de la tubería nativa `ParseUUIDPipe` para mitigar payload malformados desde la propia capa de presentación.

### 13.6 Sanitización de Logs (PII Masking)
El logger (`AuditLogger` y `Winston`) está configurado para omitir o enmascarar **Información Personal Identificable (PII)** o tokens. Se filtran proactivamente contraseñas, correos electrónicos en crudo, CVCs o tokens completos de tarjetas bancarias.

### 13.7 Verificación Extrema de Webhooks
Para endpoints públicos que reciben respuestas del Gateway de pagos:
- **Verificación de Firmas Criptográficas (`timingSafeEqual`)**: Confirmación integral comparando SHA256 hashes usando funciones de tiempo constante para evitar ataques criptográficos (Timing Attacks).
- **IP Whitelisting (Lista Blanca)** *(Opcional)*: Aplicar checks para validar que el Payload provenga exclusivamente de las direcciones IP de los datacenter autorizados del procesador de pagos (Gateway).

### 13.8 Prevención de Inyección SQL y NoSQL
El uso riguroso del patrón Data Mapper con TypeORM y **QueryBuilders parametrizados** (evitando concatenaciones de código en runtime) bloquea directamente de cara al motor de base de datos vectores de Inyección SQL.

### 13.9 AppErrorFilter (Leak Prevention)
Intercepta cualquier error de negocio (`AppError`) y las excepciones sin controlar (`HTTP 500`) retornando un formato estandarizado sin arrojar en producción `Stack Traces` o referencias directas al esquema subyacente de la BD o infraestructura, reduciendo significativamente perfiles de vulnerabilidad durante técnicas de Fingerprinting.

---

## 14. App Module y Bootstrap

### `src/app.module.ts`
1. `ConfigModule` (global) — lee `.env`
2. `ThrottlerModule` — rate limiting global
3. `WinstonModule` — logging estructurado
4. `AuditModule` (global) — logger de auditoría
5. `TypeOrmModule` — conexión DB
6. Módulos de la Aplicación.

### `src/main.ts`
Implementación estricta de `rawBody: true` (ideal para validación de Firmas en los Webhooks de pagos), inicialización de variables de entorno y middlewares globales como `helmet` y `cors`.

---

## 15. Seed de la base de datos

Carga 6 productos y stock inicial.
```bash
pnpm seed
```

---

## 16. Correr el proyecto
```bash
docker compose up -d
pnpm install
pnpm start:dev
```
La API queda disponible en: `http://localhost:4000/api`

---

## 17. Tests
El proyecto incluye tests unitarios con Jest para todas las capas críticas. Meta general de Coverage: `80%`.
```bash
pnpm test:cov
```

---

## 18. Endpoints de la API
- **GET** `/api/products` 
- **GET** `/api/products/:id` 
- **GET** `/api/stock/:productId` 
- **POST** `/api/transactions` (Requiere `X-Idempotency-Key` Headers)
- **GET** `/api/transactions/:id`
- **POST** `/api/webhooks/payment`

---

## 19. Modelo de datos
```text
┌─────────────┐       ┌─────────────┐
│  products   │       │    stock    │
├─────────────┤       ├─────────────┤
│ id (uuid)   │──1:1──│ id (uuid)   │
│ name        │       │ product_id  │
│ description │       │ quantity    │
│ price (COP) │       │ updated_at  │
│ image_url   │       └─────────────┘
│ category    │
│ created_at  │
└─────────────┘

┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│  customers  │       │  transactions    │       │  deliveries │
├─────────────┤       ├──────────────────┤       ├─────────────┤
│ id (uuid)   │──1:N──│ id (uuid)        │──1:1──│ id (uuid)   │
│ name        │       │ customer_id (fk) │       │ trans_id    │
│ email       │       │ product_id  (fk) │       │ customer_id │
│ phone       │       │ reference        │       │ address     │
│ created_at  │       │ amount_in_cents  │       │ city        │
└─────────────┘       │ status (enum)    │       │ department  │
                      │ gateway_id       │       │ status      │
                      │ created_at       │       │ created_at  │
                      │ updated_at       │       └─────────────┘
                      └──────────────────┘

┌──────────────────────┐
│   idempotency_keys   │
├──────────────────────┤
│ key (varchar 128)    │ 
│ response (jsonb)     │ 
│ status_code (int)    │
│ created_at           │
└──────────────────────┘
```
