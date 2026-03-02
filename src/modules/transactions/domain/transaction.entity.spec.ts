import { Transaction } from './transaction.entity';

describe('Transaction Entity', () => {
    const now = new Date();

    function makeTransaction(status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' = 'PENDING') {
        return new Transaction(
            'tx-id-1',
            'cust-id-1',
            'prod-id-1',
            'ref-123',
            150000,
            status,
            null,
            now,
            now,
        );
    }

    describe('constructor', () => {
        it('should create a Transaction with all provided fields', () => {
            const tx = makeTransaction();
            expect(tx.id).toBe('tx-id-1');
            expect(tx.customerId).toBe('cust-id-1');
            expect(tx.productId).toBe('prod-id-1');
            expect(tx.reference).toBe('ref-123');
            expect(tx.amountInCents).toBe(150000);
            expect(tx.status).toBe('PENDING');
            expect(tx.gatewayId).toBeNull();
            expect(tx.createdAt).toBe(now);
            expect(tx.updatedAt).toBe(now);
        });
    });

    describe('approve()', () => {
        it('should set status to APPROVED and record the gatewayId', () => {
            const tx = makeTransaction('PENDING');
            tx.approve('gw-abc');
            expect(tx.status).toBe('APPROVED');
            expect(tx.gatewayId).toBe('gw-abc');
            expect(tx.updatedAt).toBeInstanceOf(Date);
        });

        it('should update updatedAt to a new date after approve', () => {
            const tx = makeTransaction('PENDING');
            const beforeApprove = tx.updatedAt;
            tx.approve('gw-abc');
            // updatedAt should not be the same object reference (new Date())
            expect(tx.updatedAt).not.toBe(beforeApprove);
        });
    });

    describe('decline()', () => {
        it('should set status to DECLINED without gatewayId when not provided', () => {
            const tx = makeTransaction('PENDING');
            tx.decline();
            expect(tx.status).toBe('DECLINED');
            expect(tx.gatewayId).toBeNull();
            expect(tx.updatedAt).toBeInstanceOf(Date);
        });

        it('should set status to DECLINED and record gatewayId when provided', () => {
            const tx = makeTransaction('PENDING');
            tx.decline('gw-xyz');
            expect(tx.status).toBe('DECLINED');
            expect(tx.gatewayId).toBe('gw-xyz');
        });

        it('should not change gatewayId when gatewayId is empty string (falsy)', () => {
            const tx = makeTransaction('PENDING');
            tx.decline('');
            expect(tx.status).toBe('DECLINED');
            expect(tx.gatewayId).toBeNull(); // unchanged because '' is falsy
        });
    });

    describe('markError()', () => {
        it('should set status to ERROR', () => {
            const tx = makeTransaction('PENDING');
            tx.markError();
            expect(tx.status).toBe('ERROR');
            expect(tx.updatedAt).toBeInstanceOf(Date);
        });

        it('should update updatedAt to a new date after markError', () => {
            const tx = makeTransaction('PENDING');
            const before = tx.updatedAt;
            tx.markError();
            expect(tx.updatedAt).not.toBe(before);
        });
    });
});
