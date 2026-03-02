import { Stock } from './stock.entity';

describe('Stock Entity', () => {
    const now = new Date();

    function makeStock(quantity: number) {
        return new Stock('stock-1', 'prod-1', quantity, now);
    }

    describe('constructor', () => {
        it('should assign all fields correctly', () => {
            const stock = makeStock(10);
            expect(stock.id).toBe('stock-1');
            expect(stock.productId).toBe('prod-1');
            expect(stock.quantity).toBe(10);
            expect(stock.updatedAt).toBe(now);
        });
    });

    describe('isAvailable()', () => {
        it('should return true when quantity > 0', () => {
            expect(makeStock(5).isAvailable()).toBe(true);
        });

        it('should return false when quantity is 0', () => {
            expect(makeStock(0).isAvailable()).toBe(false);
        });

        it('should return false when quantity is negative', () => {
            expect(makeStock(-1).isAvailable()).toBe(false);
        });
    });

    describe('decrement()', () => {
        it('should return a new Stock with quantity decremented by 1', () => {
            const stock = makeStock(3);
            const decremented = stock.decrement();

            expect(decremented).toBeInstanceOf(Stock);
            expect(decremented.quantity).toBe(2);
            expect(decremented.id).toBe('stock-1');
            expect(decremented.productId).toBe('prod-1');
            expect(decremented.updatedAt).toBeInstanceOf(Date);
            // Original should be unchanged
            expect(stock.quantity).toBe(3);
        });

        it('should throw an error if stock is not available (quantity = 0)', () => {
            const stock = makeStock(0);
            expect(() => stock.decrement()).toThrow('Stock is not available');
        });

        it('should throw an error if stock is negative', () => {
            const stock = makeStock(-5);
            expect(() => stock.decrement()).toThrow('Stock is not available');
        });
    });
});
