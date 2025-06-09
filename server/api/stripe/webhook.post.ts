import { verifyWebhookSignature } from '~/server/utils/stripe';

export default defineEventHandler(async event => {
  try {
    const signature = getHeader(event, 'stripe-signature');
    if (!signature) {
      throw createError({
        statusCode: 400,
        message: 'No signature found in request',
      });
    }

    const rawBody = await readRawBody(event);
    if (!rawBody) {
      throw createError({
        statusCode: 400,
        message: 'No body found in request',
      });
    }

    const stripeEvent = verifyWebhookSignature(rawBody, signature);
    if (!stripeEvent) {
      throw createError({
        statusCode: 400,
        message: 'Invalid signature',
      });
    }

    // Handle different event types
    switch (stripeEvent.type) {
      case 'payment_intent.succeeded':
        // Handle successful payment
        const paymentIntent = stripeEvent.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        // Handle failed payment
        const failedPayment = stripeEvent.data.object;
        console.log('Payment failed:', failedPayment.id);
        break;

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // Handle subscription changes
        const subscription = stripeEvent.data.object;
        console.log('Subscription changed:', subscription.id);
        break;

      // Add more event types as needed
    }

    return { received: true };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message,
    });
  }
});
