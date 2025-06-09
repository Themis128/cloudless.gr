import { stripe } from '~/server/utils/stripe';

export default defineEventHandler(async event => {
  try {
    const body = await readBody(event);
    const { amount, currency = 'eur', metadata = {} } = body;

    if (!amount || amount < 1) {
      throw createError({
        statusCode: 400,
        message: 'Amount is required and must be at least 1',
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message,
    });
  }
});
