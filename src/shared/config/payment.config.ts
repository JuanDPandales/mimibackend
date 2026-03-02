import { registerAs } from '@nestjs/config';

export const paymentConfig = registerAs('payment', () => ({
    gatewaySandboxUrl: process.env.GATEWAY_SANDBOX_URL,
    gatewayPubKey: process.env.GATEWAY_PUB_KEY,
    gatewayPrvKey: process.env.GATEWAY_PRV_KEY,
    gatewayEventsKey: process.env.GATEWAY_EVENTS_KEY,
    gatewayIntegrityKey: process.env.GATEWAY_INTEGRITY_KEY,
    baseFee: Number(process.env.BASE_FEE),
    deliveryFee: Number(process.env.DELIVERY_FEE),
}));
