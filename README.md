# 🐾 Mimi Store — Backend API

API REST construida con **NestJS + TypeScript** siguiendo **Arquitectura Hexagonal (Ports & Adapters)** y **Railway Oriented Programming (ROP)**. Integra pagos con **Payment Gateway Sandbox**.

---

## Tabla de Contenidos

1. [Prerrequisitos](#1-prerrequisitos)

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

---

## 2. Estructura de carpetas

Crea esta estructura completa dentro de proyecto. Cada carpeta refleja una capa de la arquitectura hexagonal.

```
src/
│   ├── main.ts                              # Bootstrap NestJS
│   ├── app.module.ts                        # Módulo raíz
│   │
│   ├── common/
│   │   └── filters/
│   │       └── app-error.filter.ts          # Mapea AppError → HTTP
│   │
│   ├── shared/                              # Kernel compartido
│   │   ├── result/
│   │   │   ├── result.ts                    # ROP: ok/err/Result<T,E>
│   │   │   └── result.spec.ts
│   │   ├── audit/
│   │   │   ├── audit.logger.ts              # Logger estructurado
│   │   │   ├── audit.module.ts              # @Global module
│   │   │   └── audit.spec.ts
│   │   ├── config/
│   │   │   ├── throttler.config.ts          # Rate limiting por ruta
│   │   │   └── winston.config.ts            # Formato de logs
│   │   ├── database/
│   │   │   ├── typeorm.config.ts            # Conexión PostgreSQL
│   │   │   └── seed.ts                      # Datos iniciales
│   │   ├── interceptors/
│   │   │   ├── idempotency.interceptor.ts   # Previene doble cobro
│   │   │   └── idempotency.spec.ts
│   │   └── payment-gateway/
│   │       ├── payment-gateway.service.ts             # Adapter Payment Gateway API
│   │       └── payment-gateway.spec.ts
│   │
│   └── modules/
│       ├── products/
│       │   ├── domain/
│       │   │   └── product.entity.ts        # Entidad + IProductRepository
│       │   ├── application/
│       │   │   └── use-cases/
│       │   │       ├── get-products.use-case.ts
│       │   │       └── get-product-by-id.use-case.ts
│       │   ├── infrastructure/
│       │   │   ├── entities/
│       │   │   │   └── product.orm-entity.ts
│       │   │   └── repositories/
│       │   │       └── product.repository.ts
│       │   ├── presentation/
│       │   │   └── products.controller.ts
│       │   └── products.module.ts
│       │
│       ├── stock/
│       │   ├── domain/
│       │   │   ├── stock.entity.ts          # isAvailable() / decrement()
│       │   │   └── stock.spec.ts
│       │   ├── application/use-cases/
│       │   │   └── get-stock.use-case.ts
│       │   ├── infrastructure/
│       │   │   ├── entities/stock.orm-entity.ts
│       │   │   └── repositories/stock.repository.ts
│       │   ├── presentation/
│       │   │   └── stock.controller.ts
│       │   └── stock.module.ts
│       │
│       ├── customers/
│       │   ├── domain/customer.entity.ts    # ICustomerRepository
│       │   ├── infrastructure/
│       │   │   ├── entities/customer.orm-entity.ts
│       │   │   └── repositories/customer.repository.ts
│       │   └── customers.module.ts
│       │
│       ├── deliveries/
│       │   ├── domain/delivery.entity.ts    # IDeliveryRepository
│       │   ├── infrastructure/
│       │   │   ├── entities/delivery.orm-entity.ts
│       │   │   └── repositories/delivery.repository.ts
│       │   └── deliveries.module.ts
│       │
│       └── transactions/
│           ├── domain/
│           │   ├── transaction.entity.ts    # approve/decline/markError
│           │   └── transaction.spec.ts
│           ├── application/use-cases/
│           │   ├── process-payment.use-case.ts   # Core del negocio
│           │   ├── process-payment.spec.ts
│           │   └── get-transaction.use-case.ts
│           ├── infrastructure/
│           │   ├── entities/
│           │   │   ├── transaction.orm-entity.ts
│           │   │   └── idempotency-key.orm-entity.ts
│           │   └── repositories/
│           │       └── transaction.repository.ts
│           ├── presentation/
│           │   ├── dto/
│           │   │   └── process-payment.dto.ts
│           │   ├── transactions.controller.ts
│           │   └── webhooks.controller.ts   # Verifica firma Payment Gateway
│           └── transactions.module.ts
│
├── logs/                                    # Creada automáticamente
│   ├── audit.log
│   └── error.log
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env
```

Comandos para crear la estructura de directorios interna de la arquitectura hexagonal (Bash/GitBash):
```bash
mkdir -p src/common/filters
mkdir -p src/shared/{result,audit,config,database,interceptors,payment-gateway}
mkdir -p src/modules/products/{domain,application/use-cases,infrastructure/entities,infrastructure/repositories,presentation}
mkdir -p src/modules/stock/{domain,application/use-cases,infrastructure/entities,infrastructure/repositories,presentation}
mkdir -p src/modules/customers/{domain,infrastructure/entities,infrastructure/repositories}
mkdir -p src/modules/deliveries/{domain,infrastructure/entities,infrastructure/repositories}
mkdir -p src/modules/transactions/{domain,application/use-cases,infrastructure/entities,infrastructure/repositories,presentation/dto}
```

Comandos para crear los módulos y estructuras base usando Nest CLI:
```bash
# 1. Crear los Módulos
nest g module modules/products
nest g module modules/stock
nest g module modules/customers
nest g module modules/deliveries
nest g module modules/transactions

# 2. Crear Capa de Presentación (Controladores)
nest g controller modules/products/presentation/products --flat
nest g controller modules/stock/presentation/stock --flat
nest g controller modules/transactions/presentation/transactions --flat
nest g controller modules/transactions/presentation/webhooks --flat

# 3. Crear Capa de Aplicación (Casos de Uso a través de Servicios)
nest g service modules/products/application/use-cases/get-products --flat
nest g service modules/products/application/use-cases/get-product-by-id --flat
nest g service modules/stock/application/use-cases/get-stock --flat
nest g service modules/transactions/application/use-cases/process-payment --flat
nest g service modules/transactions/application/use-cases/get-transaction --flat

# 4. Crear Carpeta Shared (Kernel Compartido)
nest g module shared/audit --flat
nest g service shared/payment-gateway/payment-gateway --flat

# 5. Crear Dominio e Infraestructura (Entidades y Repositorios sin decorators)
# Entidades de Dominio
nest g class modules/products/domain/product.entity --no-spec --flat
nest g class modules/stock/domain/stock.entity --no-spec --flat
nest g class modules/customers/domain/customer.entity --no-spec --flat
nest g class modules/deliveries/domain/delivery.entity --no-spec --flat
nest g class modules/transactions/domain/transaction.entity --no-spec --flat

# Entidades ORM (Infraestructura)
nest g class modules/products/infrastructure/entities/product.orm-entity --no-spec --flat
nest g class modules/stock/infrastructure/entities/stock.orm-entity --no-spec --flat
nest g class modules/customers/infrastructure/entities/customer.orm-entity --no-spec --flat
nest g class modules/deliveries/infrastructure/entities/delivery.orm-entity --no-spec --flat
nest g class modules/transactions/infrastructure/entities/transaction.orm-entity --no-spec --flat

# Repositorios (Infraestructura)
nest g class modules/products/infrastructure/repositories/product.repository --no-spec --flat
nest g class modules/stock/infrastructure/repositories/stock.repository --no-spec --flat
nest g class modules/customers/infrastructure/repositories/customer.repository --no-spec --flat
nest g class modules/deliveries/infrastructure/repositories/delivery.repository --no-spec --flat
nest g class modules/transactions/infrastructure/repositories/transaction.repository --no-spec --flat
```

---
