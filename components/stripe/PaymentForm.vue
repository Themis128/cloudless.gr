&lt;template> &lt;div class="payment-form"> &lt;div v-if="error" class="error-message">
{{ error }}
&lt;/div> &lt;div ref="cardElement" class="card-element"> &lt;!-- Stripe Elements will be mounted
here --> &lt;/div> &lt;v-btn :loading="loading" :disabled="!stripe || !elements || loading"
color="primary" block class="mt-4" @click="handleSubmit" > Pay {{ formatAmount(amount) }}
&lt;/v-btn> &lt;/div> &lt;/template> &lt;script setup lang="ts"> import { loadStripe } from
'@stripe/stripe-js'; import type { Stripe, StripeElements, StripeCardElement } from
'@stripe/stripe-js'; import { formatAmount } from '~/server/utils/stripe'; const config =
useRuntimeConfig(); const props = defineProps<{ amount: number; currency?: string; metadata?:
Record&lt;string, string>; }>(); const emit = defineEmits&lt;{ success: [paymentIntent: any]; error:
[error: Error]; }>(); const stripe = ref&lt;Stripe | null>(null); const elements =
ref&lt;StripeElements | null>(null); const cardElement = ref&lt;StripeCardElement | null>(null);
const error = ref&lt;string>(''); const loading = ref(false); // Initialize Stripe onMounted(async
() => { try { stripe.value = await loadStripe(config.public.stripePublishableKey); if
(!stripe.value) throw new Error('Failed to load Stripe'); elements.value = stripe.value.elements();
cardElement.value = elements.value.create('card', { style: { base: { fontSize: '16px', color:
'#424770', '::placeholder': { color: '#aab7c4', }, }, invalid: { color: '#9e2146', }, }, });
cardElement.value.mount('.card-element'); cardElement.value.on('change', (event) => { if
(event.error) { error.value = event.error.message; } else { error.value = ''; } }); } catch (err:
any) { console.error('Stripe initialization error:', err); error.value = err.message; } }); // Clean
up on component unmount onUnmounted(() => { if (cardElement.value) { cardElement.value.destroy(); }
}); // Handle payment submission async function handleSubmit() { if (!stripe.value ||
!elements.value || !cardElement.value) return; loading.value = true; error.value = ''; try { //
Create payment intent const { data: { clientSecret } } = await
useFetch('/api/stripe/create-payment-intent', { method: 'POST', body: { amount: props.amount,
currency: props.currency || 'eur', metadata: props.metadata, }, }); if (!clientSecret) throw new
Error('Failed to create payment intent'); // Confirm the payment const { error: stripeError,
paymentIntent } = await stripe.value.confirmCardPayment( clientSecret as string, { payment_method: {
card: cardElement.value, billing_details: { address: { country: 'GR', // Set Greece as default
country }, }, }, } ); if (stripeError) { throw new Error(stripeError.message); } else if
(paymentIntent?.status === 'succeeded') { emit('success', paymentIntent); } } catch (err: any) {
console.error('Payment error:', err); error.value = err.message; emit('error', err); } finally {
loading.value = false; } } &lt;/script> &lt;style scoped> .payment-form { max-width: 500px; margin:
0 auto; } .card-element { padding: 12px; border: 1px solid #e0e0e0; border-radius: 4px; background:
white; } .error-message { color: #9e2146; margin-bottom: 16px; font-size: 14px; } &lt;/style>
