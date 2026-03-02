import 'dotenv/config';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';
import { CustomerOrmEntity } from './src/modules/customers/infrastructure/entities/customer.orm-entity';
import { DeliveryOrmEntity } from './src/modules/deliveries/infrastructure/entities/delivery.orm-entity';
import { ProductOrmEntity } from './src/modules/products/infrastructure/entities/product.orm-entity';
import { StockOrmEntity } from './src/modules/stock/infrastructure/entities/stock.orm-entity';
import { IdempotencyKeyOrmEntity } from './src/modules/transactions/infrastructure/entities/idempotency-key.orm-entity';
import { TransactionOrmEntity } from './src/modules/transactions/infrastructure/entities/transaction.orm-entity';


const appDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'PunPr333123sss0rf',
    database: process.env.DB_NAME || 'postgres',
    entities: [
        ProductOrmEntity,
        StockOrmEntity,
        CustomerOrmEntity,
        DeliveryOrmEntity,
        TransactionOrmEntity,
        IdempotencyKeyOrmEntity
    ],
    synchronize: true, // Auto-create tables for simplicity in dev/seed
    ssl: {
        rejectUnauthorized: false
    }
});

async function createDatabase() {
    const tempDataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'PunPr333123sss0rf',
        database: 'postgres',
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await tempDataSource.initialize();
        const result = await tempDataSource.query(`SELECT 1 FROM pg_database WHERE datname = 'mimidatabase'`);
        if (result.length === 0) {
            await tempDataSource.query(`CREATE DATABASE mimidatabase`);
            console.log('Database "mimidatabase" created successfully.');
        } else {
            console.log('Database "mimidatabase" already exists.');
        }
    } catch (error) {
        console.error('Error creating database:', error);
    } finally {
        await tempDataSource.destroy();
    }
}

async function runSeed() {
    await createDatabase();
    try {
        await appDataSource.initialize();
        console.log('Database connection initialized.');

        const productRepo = appDataSource.getRepository(ProductOrmEntity);
        const stockRepo = appDataSource.getRepository(StockOrmEntity);

        const count = await productRepo.count();
        if (count > 0) {
            console.log('Database already seeded. Skipping.');
            await appDataSource.destroy();
            return;
        }

        const products = [
            { id: crypto.randomUUID(), name: 'Classic Leather Collar', description: 'Durable brown leather collar for medium dogs.', price: 15000, category: 'Collars', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Chew Toy Bone', description: 'Indestructible rubber bone toy.', price: 8000, category: 'Toys', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Premium Dog Food 5kg', description: 'Nutritious dry food for adult dogs.', price: 45000, category: 'Food', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Soft Paws Cozy Bed', description: 'Plush and warm bed for small and medium pets.', price: 60000, category: 'Beds', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Reflective Leash', description: 'Safety reflective leash for night walks.', price: 12000, category: 'Leashes', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Pet Grooming Brush', description: 'Gentle deshedding brush.', price: 10000, category: 'Grooming', imageUrl: 'https://via.placeholder.com/150' },

            { id: crypto.randomUUID(), name: 'Adjustable Nylon Collar', description: 'Lightweight and adjustable collar for small dogs.', price: 9000, category: 'Collars', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Interactive Treat Ball', description: 'Toy that dispenses treats while playing.', price: 14000, category: 'Toys', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Grain-Free Dog Food 10kg', description: 'High-protein formula for active dogs.', price: 85000, category: 'Food', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Orthopedic Pet Bed', description: 'Memory foam bed for senior pets.', price: 95000, category: 'Beds', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Retractable Leash 5m', description: 'Extendable leash with ergonomic grip.', price: 30000, category: 'Leashes', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Pet Shampoo Aloe Vera', description: 'Moisturizing shampoo for sensitive skin.', price: 18000, category: 'Grooming', imageUrl: 'https://via.placeholder.com/150' },

            { id: crypto.randomUUID(), name: 'LED Light-Up Collar', description: 'Rechargeable collar with LED visibility.', price: 25000, category: 'Collars', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Rope Tug Toy', description: 'Strong cotton rope for tug-of-war games.', price: 7000, category: 'Toys', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Wet Dog Food Pack x12', description: 'Assorted flavors wet food cans.', price: 52000, category: 'Food', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Cooling Pet Mat', description: 'Self-cooling mat for hot days.', price: 40000, category: 'Beds', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Hands-Free Running Leash', description: 'Waist leash ideal for jogging with your dog.', price: 35000, category: 'Leashes', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Nail Clipper Pro', description: 'Professional stainless steel nail clipper.', price: 16000, category: 'Grooming', imageUrl: 'https://via.placeholder.com/150' },

            { id: crypto.randomUUID(), name: 'Personalized Name Collar', description: 'Custom engraved collar with pet name.', price: 28000, category: 'Collars', imageUrl: 'https://via.placeholder.com/150' },
            { id: crypto.randomUUID(), name: 'Squeaky Plush Toy', description: 'Soft plush toy with built-in squeaker.', price: 11000, category: 'Toys', imageUrl: 'https://via.placeholder.com/150' },
        ];

        for (const p of products) {
            const product = productRepo.create({
                id: p.id,
                name: p.name,
                description: p.description,
                price: p.price,
                category: p.category,
                imageUrl: p.imageUrl
            });

            await productRepo.save(product);

            const stock = stockRepo.create({
                id: crypto.randomUUID(),
                productId: product.id,
                quantity: 10,
            });

            await stockRepo.save(stock);
        }

        console.log('Successfully seeded 6 generic pet products and their initial stock!');
    } catch (error) {
        console.error('Error during seeding:', error);
    } finally {
        await appDataSource.destroy();
    }
}

runSeed();
